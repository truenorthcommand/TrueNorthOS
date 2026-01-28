import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { storage } from "./storage";
import type { Job, Client, Quote, Invoice, AiMessage } from "@shared/schema";
import { getBoundedBusinessContext, getBusinessStats } from "./globalAssistant/context";
import { buildBudgetedContext, limitWebResults, DEFAULT_BUDGET } from "./globalAssistant/tokenBudget";
import { cacheGet, cacheSet, getCacheKey, CACHE_TTL } from "./globalAssistant/cache";

// Tavily Web Search types
interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilySearchResponse {
  results: TavilySearchResult[];
  answer?: string;
}

function enhanceSearchQuery(query: string): string {
  const lowerQuery = query.toLowerCase();
  
  // Check if this is a product/price search
  const isProductSearch = [
    "price", "cost", "buy", "purchase", "where to get",
    "stockist", "supplier", "merchant", "wholesaler",
    "boiler", "radiator", "thermostat", "pump", "valve",
    "cable", "switch", "socket", "fuse", "circuit",
    "pipe", "fitting", "tap", "toilet", "sink"
  ].some(term => lowerQuery.includes(term));
  
  // Enhance product searches to get direct product pages
  if (isProductSearch && !lowerQuery.includes("product page")) {
    return `${query} UK buy price product page`;
  }
  
  // Add UK context for regulation searches
  if (lowerQuery.includes("regulation") || lowerQuery.includes("bs 7671") || 
      lowerQuery.includes("gas safe") || lowerQuery.includes("part p")) {
    return `${query} UK official`;
  }
  
  return query;
}

async function searchWeb(query: string): Promise<{ results: TavilySearchResult[]; answer?: string } | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.log("Tavily API key not configured");
    return null;
  }

  // Enhance query to get more specific product links
  const enhancedQuery = enhanceSearchQuery(query);
  console.log("Enhanced search query:", enhancedQuery);

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: enhancedQuery,
        search_depth: "advanced", // Use advanced for better product page results
        include_answer: true,
        include_raw_content: false,
        max_results: 8, // Get more results to find direct product links
      }),
    });

    if (!response.ok) {
      console.error("Tavily search failed:", response.statusText);
      return null;
    }

    const data = await response.json() as TavilySearchResponse;
    return {
      results: data.results || [],
      answer: data.answer,
    };
  } catch (error) {
    console.error("Error calling Tavily:", error);
    return null;
  }
}

function shouldSearchWeb(message: string): boolean {
  const searchTriggers = [
    "search for",
    "search the web",
    "look up",
    "find online",
    "google",
    "research",
    "what is",
    "how to",
    "where can i",
    "where to buy",
    "supplier",
    "price of",
    "cost of",
    "regulations",
    "bs 7671",
    "gas safe",
    "building regs",
    "part p",
    "wiring regulations",
    "specifications",
    "specs for",
    "datasheet",
    "technical",
    "manufacturer",
    "stockist",
    "wholesaler",
    "trade counter",
    "plumbers merchant",
    "electrical wholesaler",
    "compare",
    "alternative to",
    "equivalent",
  ];

  const lowerMessage = message.toLowerCase();
  return searchTriggers.some(trigger => lowerMessage.includes(trigger));
}

function getOpenAIClient(): OpenAI | null {
  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    return new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  if (process.env.OPENAI_API_KEY) {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return null;
}

const SYSTEM_PROMPT = `You are TrueNorth AI, the intelligent assistant for TrueNorth Trade OS - a comprehensive field service management platform for UK trade businesses.

You have access to business data and can help with:
- Searching jobs, clients, quotes, invoices
- Providing insights about workload, financials, and operations
- Answering questions about the platform
- Helping navigate and use features
- Offering proactive suggestions
- Searching the web for products, suppliers, regulations, and technical information

CAPABILITIES:
1. SEARCH: Find jobs, clients, quotes, invoices by natural language
2. WEB SEARCH: Research products, suppliers, regulations, specifications, and technical info online
3. INSIGHTS: Analyze business data and provide actionable insights
4. NAVIGATION: Guide users to the right features and pages
5. COMMANDS: Help create jobs, quotes, invoices, assign engineers

WEB SEARCH:
When the user asks about products, suppliers, regulations, or technical specifications, I automatically search the web and include source links. I can help research:
- Trade suppliers and wholesalers (plumbers merchants, electrical wholesalers)
- Product specifications and datasheets
- UK regulations (BS 7671, Gas Safe, Part P, Building Regs)
- Material prices and alternatives
- Technical how-to guides

IMPORTANT - DIRECT PRODUCT LINKS:
When providing web search results for products, I ALWAYS give direct links to the specific product page, NOT just the store homepage. For example:
- GOOD: https://www.screwfix.com/p/vaillant-ecotec-plus-832-combi-boiler/12345
- BAD: https://www.screwfix.com
I extract and present the most specific, deep links available from search results so users can go directly to the product, price, or specification page without additional searching.

CONTEXT PROVIDED:
- Current page the user is viewing
- User's role and permissions
- Summary of business data (jobs, clients, quotes, invoices)

RESPONSE STYLE:
- Be concise and helpful
- Use bullet points for lists
- Provide specific numbers when discussing data
- Suggest next actions when appropriate
- Be proactive about identifying issues or opportunities

When asked to search, analyze the provided context and give specific results.
When asked about navigation, provide clear paths (e.g., "Go to Jobs > Active Jobs").
When asked to do something, confirm what you'll help with and guide them through it.

IMPORTANT: You're integrated into a UK trade business platform. Use UK terminology (e.g., "enquiry" not "inquiry", "cheque" not "check", VAT not sales tax).`;

interface SearchResult {
  type: 'job' | 'client' | 'quote' | 'invoice';
  id: string;
  title: string;
  subtitle: string;
  status?: string;
}


async function searchEntities(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const searchTerm = query.toLowerCase();

  try {
    const [jobs, clients, quotes, invoices] = await Promise.all([
      storage.getAllJobs(),
      storage.getAllClients(),
      storage.getAllQuotes(),
      storage.getAllInvoices(),
    ]);

    jobs.forEach((job: Job) => {
      const jobTitle = job.nickname || job.customerName || '';
      if (
        jobTitle.toLowerCase().includes(searchTerm) ||
        job.description?.toLowerCase().includes(searchTerm) ||
        job.address?.toLowerCase().includes(searchTerm) ||
        job.postcode?.toLowerCase().includes(searchTerm) ||
        job.customerName?.toLowerCase().includes(searchTerm)
      ) {
        results.push({
          type: 'job',
          id: job.id,
          title: `#${job.jobNo}: ${jobTitle}`,
          subtitle: job.address || job.postcode || '',
          status: job.status || undefined,
        });
      }
    });

    clients.forEach((client: Client) => {
      if (
        client.name?.toLowerCase().includes(searchTerm) ||
        client.email?.toLowerCase().includes(searchTerm) ||
        client.phone?.toLowerCase().includes(searchTerm) ||
        client.address?.toLowerCase().includes(searchTerm)
      ) {
        results.push({
          type: 'client',
          id: client.id,
          title: client.name,
          subtitle: client.email || client.phone || '',
        });
      }
    });

    quotes.forEach((quote: Quote) => {
      const client = clients.find((c: Client) => c.id === quote.customerId);
      if (
        client?.name?.toLowerCase().includes(searchTerm) ||
        quote.customerName?.toLowerCase().includes(searchTerm) ||
        quote.notes?.toLowerCase().includes(searchTerm)
      ) {
        results.push({
          type: 'quote',
          id: quote.id,
          title: `Quote #${quote.quoteNo || quote.id}`,
          subtitle: `£${quote.total} - ${quote.customerName || client?.name || 'Unknown client'}`,
          status: quote.status || undefined,
        });
      }
    });

    invoices.forEach((invoice: Invoice) => {
      const client = clients.find((c: Client) => c.id === invoice.customerId);
      if (
        client?.name?.toLowerCase().includes(searchTerm) ||
        invoice.customerName?.toLowerCase().includes(searchTerm) ||
        invoice.notes?.toLowerCase().includes(searchTerm)
      ) {
        results.push({
          type: 'invoice',
          id: invoice.id,
          title: `Invoice #${invoice.invoiceNo || invoice.id}`,
          subtitle: `£${invoice.total} - ${invoice.customerName || client?.name || 'Unknown client'}`,
          status: invoice.status || undefined,
        });
      }
    });
  } catch (error) {
    console.error("Error searching entities:", error);
  }

  return results.slice(0, 10);
}

export function registerGlobalAssistantRoutes(app: Express): void {
  // Get user's conversation history
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

  // Get a specific conversation
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

  // Create a new conversation
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

  // Delete/archive a conversation
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

      // Archive instead of delete
      await storage.updateAiConversation(req.params.id, { isArchived: true });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // Chat endpoint with conversation persistence
  app.post("/api/global-assistant/chat", async (req: Request, res: Response) => {
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

      // Track user action for learning
      storage.trackUserAction(userId, currentPage || 'dashboard').catch(console.error);

      // Get or create conversation
      let activeConversationId = conversationId;
      if (conversationId) {
        // Save user message to existing conversation
        const userMessage: AiMessage = {
          role: "user",
          content: message,
          timestamp: new Date().toISOString(),
        };
        await storage.addMessageToConversation(conversationId, userMessage);
      }

      const businessContext = await getBoundedBusinessContext(userId, 'chat');

      // Check if web search is needed
      let webSearchResults = "";
      if (shouldSearchWeb(message)) {
        console.log("Performing web search for:", message);
        const searchData = await searchWeb(message);
        if (searchData && searchData.results.length > 0) {
          const limitedResults = limitWebResults(searchData.results, DEFAULT_BUDGET.maxWebResults);
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

      // Build budgeted context
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

      const stream = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages,
        stream: true,
        max_completion_tokens: 1024,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      // Save assistant response to conversation
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
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to process message" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process message" });
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
      
      // Check cache first
      const cached = await cacheGet<string[]>(cacheKey);
      if (cached) {
        return res.json({ suggestions: cached });
      }
      
      // Get dynamic suggestions based on business context
      const dynamicSuggestions = await getDynamicSuggestions(currentPage);
      
      // Cache for 30 minutes
      await cacheSet(cacheKey, dynamicSuggestions, CACHE_TTL.SUGGESTIONS, userId);
      
      res.json({ suggestions: dynamicSuggestions });
    } catch (error) {
      console.error("Error getting suggestions:", error);
      res.status(500).json({ error: "Failed to get suggestions" });
    }
  });

  // Smart insights endpoint with business alerts
  app.get("/api/global-assistant/insights", async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const cacheKey = getCacheKey('insights', userId);
      
      // Check cache first
      const cached = await cacheGet<{ insights: SmartInsight[]; summary: { activeJobs: number; overdueInvoices: number; pendingQuotes: number; totalOutstanding: number } }>(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const insights = await getSmartInsights();
      
      // Cache for 6 hours
      await cacheSet(cacheKey, insights, CACHE_TTL.SMART_INSIGHTS, userId);
      
      res.json(insights);
    } catch (error) {
      console.error("Error getting smart insights:", error);
      res.status(500).json({ error: "Failed to get insights" });
    }
  });
}

interface SmartInsight {
  type: 'alert' | 'opportunity' | 'info';
  title: string;
  description: string;
  action?: string;
  actionPath?: string;
  priority: 'high' | 'medium' | 'low';
}

async function getSmartInsights(): Promise<{ insights: SmartInsight[]; summary: { activeJobs: number; overdueInvoices: number; pendingQuotes: number; totalOutstanding: number } }> {
  try {
    const [jobs, invoices, quotes, clients] = await Promise.all([
      storage.getAllJobs(),
      storage.getAllInvoices(),
      storage.getAllQuotes(),
      storage.getAllClients(),
    ]);

    const insights: SmartInsight[] = [];
    const now = new Date();

    // Active jobs count
    const activeJobs = jobs.filter(j => j.status !== 'Signed Off' && j.status !== 'Draft').length;
    
    // Overdue invoices alert
    const overdueInvoices = invoices.filter(inv => {
      if (inv.status === 'Paid' || inv.status === 'Draft') return false;
      if (!inv.dueDate) return false;
      return new Date(inv.dueDate) < now;
    });
    
    if (overdueInvoices.length > 0) {
      const overdueTotal = overdueInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      insights.push({
        type: 'alert',
        title: `${overdueInvoices.length} Overdue Invoice${overdueInvoices.length > 1 ? 's' : ''}`,
        description: `£${overdueTotal.toLocaleString()} outstanding past due date`,
        action: 'View overdue invoices',
        actionPath: '/invoices?status=overdue',
        priority: 'high',
      });
    }

    // Pending quotes opportunity
    const pendingQuotes = quotes.filter(q => q.status === 'Sent' || q.status === 'Pending');
    const oldPendingQuotes = pendingQuotes.filter(q => {
      if (!q.createdAt) return false;
      const daysSent = Math.floor((now.getTime() - new Date(q.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      return daysSent > 7;
    });

    if (oldPendingQuotes.length > 0) {
      insights.push({
        type: 'opportunity',
        title: `${oldPendingQuotes.length} Quote${oldPendingQuotes.length > 1 ? 's' : ''} Awaiting Response`,
        description: 'Quotes sent over 7 days ago - consider following up',
        action: 'View pending quotes',
        actionPath: '/quotes',
        priority: 'medium',
      });
    }

    // Jobs awaiting sign-off
    const awaitingSignOff = jobs.filter(j => j.status === 'Awaiting Signatures');
    if (awaitingSignOff.length > 0) {
      insights.push({
        type: 'info',
        title: `${awaitingSignOff.length} Job${awaitingSignOff.length > 1 ? 's' : ''} Awaiting Sign-off`,
        description: 'Jobs completed and ready for customer sign-off',
        action: 'View jobs',
        actionPath: '/jobs',
        priority: 'medium',
      });
    }

    // High-value clients without recent jobs
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const inactiveClients = clients.filter(client => {
      const clientJobs = jobs.filter(j => j.client === client.id || j.customerName === client.name);
      if (clientJobs.length === 0) return false;
      const lastJob = clientJobs.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB.getTime() - dateA.getTime();
      })[0];
      const lastJobDate = lastJob.createdAt ? new Date(lastJob.createdAt) : null;
      return lastJobDate && lastJobDate < threeMonthsAgo;
    });

    if (inactiveClients.length > 0) {
      insights.push({
        type: 'opportunity',
        title: 'Inactive Client Opportunity',
        description: `${inactiveClients.length} client${inactiveClients.length > 1 ? 's haven\'t' : ' hasn\'t'} had work in 3+ months`,
        action: 'View clients',
        actionPath: '/clients',
        priority: 'low',
      });
    }

    // Today's jobs reminder
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todaysJobs = jobs.filter(j => {
      if (!j.date) return false;
      const jobDate = new Date(j.date);
      return jobDate >= today && jobDate < tomorrow && j.status !== 'Signed Off';
    });

    if (todaysJobs.length > 0) {
      insights.push({
        type: 'info',
        title: `${todaysJobs.length} Job${todaysJobs.length > 1 ? 's' : ''} Today`,
        description: `Scheduled work for ${today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`,
        action: 'View schedule',
        actionPath: '/schedule/calendar',
        priority: 'medium',
      });
    }

    // Calculate summary
    const unpaidInvoices = invoices.filter(inv => inv.status !== 'Paid' && inv.status !== 'Draft');
    const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

    return {
      insights: insights.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }).slice(0, 5),
      summary: {
        activeJobs,
        overdueInvoices: overdueInvoices.length,
        pendingQuotes: pendingQuotes.length,
        totalOutstanding,
      },
    };
  } catch (error) {
    console.error("Error generating smart insights:", error);
    return { insights: [], summary: { activeJobs: 0, overdueInvoices: 0, pendingQuotes: 0, totalOutstanding: 0 } };
  }
}

async function getDynamicSuggestions(page: string): Promise<string[]> {
  try {
    const [jobs, invoices, quotes] = await Promise.all([
      storage.getAllJobs(),
      storage.getAllInvoices(),
      storage.getAllQuotes(),
    ]);

    const now = new Date();
    const dynamicSuggestions: string[] = [];

    // Add dynamic suggestions based on business state
    const overdueInvoices = invoices.filter(inv => {
      if (inv.status === 'Paid' || inv.status === 'Draft') return false;
      if (!inv.dueDate) return false;
      return new Date(inv.dueDate) < now;
    });

    const activeJobs = jobs.filter(j => j.status === 'In Progress').length;
    const pendingQuotes = quotes.filter(q => q.status === 'Sent' || q.status === 'Pending').length;

    // Context-aware suggestions
    if (overdueInvoices.length > 0 && (page === 'dashboard' || page === 'invoices')) {
      dynamicSuggestions.push(`Review ${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? 's' : ''}`);
    }

    if (activeJobs > 0 && page === 'dashboard') {
      dynamicSuggestions.push(`Check progress on ${activeJobs} active job${activeJobs > 1 ? 's' : ''}`);
    }

    if (pendingQuotes > 0 && (page === 'dashboard' || page === 'quotes')) {
      dynamicSuggestions.push(`Follow up on ${pendingQuotes} pending quote${pendingQuotes > 1 ? 's' : ''}`);
    }

    // Add page-specific static suggestions
    const pageSuggestions = getPageSuggestions(page);
    
    // Combine dynamic + static, avoiding duplicates
    return [...dynamicSuggestions, ...pageSuggestions].slice(0, 4);
  } catch (error) {
    console.error("Error generating dynamic suggestions:", error);
    return getPageSuggestions(page);
  }
}

function getPageSuggestions(page: string): string[] {
  const pageSuggestions: Record<string, string[]> = {
    dashboard: [
      "Show me today's jobs",
      "What invoices are overdue?",
      "Search for a supplier near me",
      "Look up BS 7671 regulations",
    ],
    jobs: [
      "Find jobs in London",
      "Show incomplete jobs",
      "Which engineer is available?",
      "Create a new job",
    ],
    clients: [
      "Find clients without recent jobs",
      "Show clients with outstanding invoices",
      "Add a new client",
    ],
    quotes: [
      "Show pending quotes",
      "What's our quote conversion rate?",
      "Create a quote for a new client",
    ],
    invoices: [
      "Show overdue invoices",
      "What's outstanding this month?",
      "Generate invoice reminders",
    ],
    timesheets: [
      "Show hours worked this week",
      "Who has unapproved timesheets?",
      "What's the overtime total?",
    ],
    expenses: [
      "Show pending expense claims",
      "What are this month's expenses?",
      "Submit a new expense",
    ],
    fleet: [
      "Which vehicles need inspection?",
      "Show active defects",
      "Schedule a service",
    ],
    messages: [
      "Send a message to the team",
      "Create a group chat",
      "Check unread messages",
    ],
    default: [
      "How can I help you today?",
      "Show me business overview",
      "What needs my attention?",
      "Search for something",
    ],
  };

  return pageSuggestions[page.toLowerCase()] || pageSuggestions.default;
}
