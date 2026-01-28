import type { Express, Request, Response } from "express";
import type { AiMessage } from "@shared/schema";
import { storage } from "../storage";
import { getOpenAIClient, getErrorMessage } from "./openai";
import { SYSTEM_PROMPT } from "./prompts";
import { searchWeb, shouldSearchWeb, searchEntities } from "./search";
import { getSmartInsights, getDynamicSuggestions, SmartInsight } from "./insights";
import { getBoundedBusinessContext } from "./context";
import { buildBudgetedContext, limitWebResults, DEFAULT_BUDGET } from "./tokenBudget";
import { cacheGet, cacheSet, getCacheKey, CACHE_TTL } from "./cache";
import { AI_CONFIG, getModelWithFallback, enableFallbackModel, isModelNotFoundError } from "./config";
import { withRetry, isRetryableError } from "./retry";

export function registerGlobalAssistantRoutes(app: Express): void {
  app.get("/api/global-assistant/conversations", async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const conversations = await storage.getAiConversationsByUser(userId);
      res.json({ conversations });
    } catch (error) {
      console.error("Error getting conversations:", error);
      res.status(500).json({ error: "Failed to get conversations" });
    }
  });

  app.get("/api/global-assistant/conversations/:id", async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const conversation = await storage.getAiConversation(req.params.id);
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      res.json({ conversation });
    } catch (error) {
      console.error("Error getting conversation:", error);
      res.status(500).json({ error: "Failed to get conversation" });
    }
  });

  app.post("/api/global-assistant/conversations", async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { context } = req.body;
      const conversation = await storage.createAiConversation({
        userId,
        title: "New Conversation",
        messages: [],
        context: context || null,
        isArchived: false,
        lastMessageAt: new Date(),
      });

      res.json({ conversation });
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.delete("/api/global-assistant/conversations/:id", async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const conversation = await storage.getAiConversation(req.params.id);
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      await storage.updateAiConversation(req.params.id, { isArchived: true });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  app.post("/api/global-assistant/chat", async (req: Request, res: Response) => {
    let clientDisconnected = false;
    
    req.on('close', () => {
      clientDisconnected = true;
      console.log("[Chat] Client disconnected");
    });
    
    try {
      const openai = getOpenAIClient();
      if (!openai) {
        return res.status(503).json({ error: "AI service not configured" });
      }

      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { message, currentPage, conversationId, conversationHistory = [] } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      storage.trackUserAction(userId, currentPage || 'dashboard').catch(console.error);

      let activeConversationId = conversationId;
      if (conversationId) {
        const userMessage: AiMessage = {
          role: "user",
          content: message,
          timestamp: new Date().toISOString(),
        };
        await storage.addMessageToConversation(conversationId, userMessage);
      }

      const businessContext = await getBoundedBusinessContext(userId, 'chat');

      let webSearchResults = "";
      const searchTrigger = shouldSearchWeb(message);
      if (searchTrigger.shouldSearch) {
        console.log(`[Chat] Performing web search for: "${message}" (matched: ${searchTrigger.matchedPattern})`);
        const searchData = await searchWeb(message);
        if (searchData && searchData.results.length > 0) {
          const limitedResults = limitWebResults(searchData.results, Math.min(DEFAULT_BUDGET.maxWebResults, 3));
          webSearchResults = `\n\nWEB SEARCH RESULTS:`;
          if (searchData.answer) {
            webSearchResults += `\nSummary: ${searchData.answer}\n`;
          }
          webSearchResults += `\nSources:`;
          limitedResults.forEach((result, i) => {
            webSearchResults += `\n${i + 1}. ${result.title}\n   URL: ${result.url}\n   ${result.content.slice(0, 200)}...`;
          });
        }
      }

      const budgeted = buildBudgetedContext({
        businessContext,
        conversationHistory,
        webResults: webSearchResults || undefined,
      });

      const contextMessage = `
CURRENT CONTEXT:
- Page: ${currentPage || 'Dashboard'}
${budgeted.context}

USER MESSAGE: ${message}`;

      const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: SYSTEM_PROMPT },
        ...budgeted.conversationHistory.map((msg: { role: string; content: string }) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        { role: "user", content: contextMessage },
      ];

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const createStream = async (modelToUse: string) => {
        console.log(`[Chat] Using model: ${modelToUse}`);
        return openai.chat.completions.create({
          model: modelToUse,
          messages,
          stream: true,
          max_completion_tokens: AI_CONFIG.maxCompletionTokens,
        });
      };

      let stream;
      const { model: selectedModel, isFallback } = getModelWithFallback();
      
      try {
        stream = await withRetry(
          () => createStream(selectedModel),
          { maxRetries: AI_CONFIG.maxRetries },
          isRetryableError
        );
      } catch (streamError) {
        if (isModelNotFoundError(streamError) && !isFallback) {
          console.log(`[Chat] Primary model failed, trying fallback model: ${AI_CONFIG.fallbackModel}`);
          enableFallbackModel();
          stream = await withRetry(
            () => createStream(AI_CONFIG.fallbackModel),
            { maxRetries: AI_CONFIG.maxRetries },
            isRetryableError
          );
        } else {
          throw streamError;
        }
      }

      let fullResponse = "";

      for await (const chunk of stream) {
        if (clientDisconnected) {
          console.log("[Chat] Client disconnected, stopping stream processing");
          break;
        }
        
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      if (clientDisconnected) {
        return;
      }

      if (conversationId && fullResponse) {
        const assistantMessage: AiMessage = {
          role: "assistant",
          content: fullResponse,
          timestamp: new Date().toISOString(),
        };
        await storage.addMessageToConversation(conversationId, assistantMessage);
      }

      res.write(`data: ${JSON.stringify({ done: true, fullResponse, conversationId: activeConversationId })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error in global assistant:", error);
      const errorMessage = getErrorMessage(error);
      
      if (clientDisconnected) {
        return;
      }
      
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: errorMessage });
      }
    }
  });

  app.post("/api/global-assistant/search", async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      const results = await searchEntities(query);
      res.json({ results });
    } catch (error) {
      console.error("Error in global assistant search:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  app.get("/api/global-assistant/suggestions", async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const currentPage = req.query.page as string || 'dashboard';
      const cacheKey = getCacheKey('suggestions', `${userId}:${currentPage}`);
      
      const cached = await cacheGet<string[]>(cacheKey);
      if (cached) {
        return res.json({ suggestions: cached });
      }
      
      const dynamicSuggestions = await getDynamicSuggestions(currentPage);
      
      await cacheSet(cacheKey, dynamicSuggestions, CACHE_TTL.SUGGESTIONS, userId);
      
      res.json({ suggestions: dynamicSuggestions });
    } catch (error) {
      console.error("Error getting suggestions:", error);
      res.status(500).json({ error: "Failed to get suggestions" });
    }
  });

  app.get("/api/global-assistant/insights", async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const cacheKey = getCacheKey('insights', userId);
      
      const cached = await cacheGet<{ insights: SmartInsight[]; summary: { activeJobs: number; overdueInvoices: number; pendingQuotes: number; totalOutstanding: number } }>(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const insights = await getSmartInsights();
      
      await cacheSet(cacheKey, insights, CACHE_TTL.SMART_INSIGHTS, userId);
      
      res.json(insights);
    } catch (error) {
      console.error("Error getting smart insights:", error);
      res.status(500).json({ error: "Failed to get insights" });
    }
  });
}
