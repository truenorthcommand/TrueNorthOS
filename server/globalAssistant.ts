import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { storage } from "./storage";
import type { Job, Client, Quote, Invoice, AiMessage, AiBusinessPattern, AiUserPreference } from "@shared/schema";

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

async function getLearnedPatterns(): Promise<string> {
  try {
    const patterns = await storage.getAiBusinessPatterns();
    if (patterns.length === 0) return "";
    
    const pricingPatterns = patterns.filter(p => p.patternType === 'pricing');
    const materialPatterns = patterns.filter(p => p.patternType === 'materials');
    const engineerPatterns = patterns.filter(p => p.patternType === 'engineer_assignment');
    
    let context = "\n\nLEARNED BUSINESS PATTERNS:";
    
    if (pricingPatterns.length > 0) {
      const pricing = pricingPatterns[0].data as { avgPrice: number; minPrice: number; maxPrice: number; sampleSize: number };
      context += `\n- Typical Quote Range: £${pricing.minPrice.toFixed(0)} - £${pricing.maxPrice.toFixed(0)} (avg: £${pricing.avgPrice.toFixed(0)}, based on ${pricing.sampleSize} quotes)`;
    }
    
    if (materialPatterns.length > 0) {
      const topMaterials = materialPatterns.slice(0, 5);
      context += `\n- Common Materials: ${topMaterials.map(m => (m.data as { materialName: string }).materialName).join(', ')}`;
    }
    
    if (engineerPatterns.length > 0) {
      const topEngineers = engineerPatterns.slice(0, 3);
      context += `\n- Most Active Engineers: ${topEngineers.map(e => (e.data as { engineerName: string }).engineerName).join(', ')}`;
    }
    
    return context;
  } catch (error) {
    console.error("Error fetching learned patterns:", error);
    return "";
  }
}

async function getUserPreferenceContext(userId: string): Promise<string> {
  try {
    const pref = await storage.getAiUserPreference(userId);
    if (!pref) return "";
    
    let context = "\n\nUSER PREFERENCES:";
    context += `\n- Communication style: ${pref.communicationStyle || 'professional'}`;
    
    const actions = (pref.preferredActions as { action: string; count: number }[]) || [];
    if (actions.length > 0) {
      const topActions = actions.slice(0, 5).map(a => a.action);
      context += `\n- Frequent actions: ${topActions.join(', ')}`;
    }
    
    return context;
  } catch (error) {
    console.error("Error fetching user preferences:", error);
    return "";
  }
}

async function getBusinessContext(userId: string): Promise<string> {
  try {
    const [jobs, clients, quotes, invoices, user] = await Promise.all([
      storage.getAllJobs(),
      storage.getAllClients(),
      storage.getAllQuotes(),
      storage.getAllInvoices(),
      storage.getUser(userId),
    ]);

    const activeJobs = jobs.filter((j: Job) => j.status === 'in_progress' || j.status === 'pending');
    const completedJobs = jobs.filter((j: Job) => j.status === 'completed');
    const pendingQuotes = quotes.filter((q: Quote) => q.status === 'pending' || q.status === 'sent');
    const unpaidInvoices = invoices.filter((i: Invoice) => i.status === 'sent' || i.status === 'overdue');
    const overdueInvoices = invoices.filter((i: Invoice) => i.status === 'overdue');

    const totalUnpaid = unpaidInvoices.reduce((sum: number, inv: Invoice) => sum + Number(inv.total || 0), 0);

    // Get learned patterns and user preferences
    const [learnedPatterns, userPreferences] = await Promise.all([
      getLearnedPatterns(),
      getUserPreferenceContext(userId),
    ]);

    return `
BUSINESS SUMMARY:
- Total Clients: ${clients.length}
- Active Jobs: ${activeJobs.length}
- Completed Jobs: ${completedJobs.length}
- Pending Quotes: ${pendingQuotes.length}
- Unpaid Invoices: ${unpaidInvoices.length} (£${totalUnpaid.toLocaleString()})
- Overdue Invoices: ${overdueInvoices.length}

USER: ${user?.name || 'Unknown'} (${user?.role || 'user'})

RECENT JOBS (last 5):
${jobs.slice(0, 5).map((j: Job) => `- #${j.jobNo}: ${j.nickname || j.customerName} - ${j.status}`).join('\n')}

RECENT CLIENTS (last 5):
${clients.slice(0, 5).map((c: Client) => `- #${c.id}: ${c.name} - ${c.email || 'no email'}`).join('\n')}

RECENT QUOTES (last 5):
${quotes.slice(0, 5).map((q: Quote) => `- #${q.id}: £${q.total} - ${q.status}`).join('\n')}

RECENT INVOICES (last 5):
${invoices.slice(0, 5).map((i: Invoice) => `- #${i.id}: £${i.total} - ${i.status}`).join('\n')}
${learnedPatterns}${userPreferences}
`;
  } catch (error) {
    console.error("Error fetching business context:", error);
    return "Unable to fetch business data at this time.";
  }
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

      const businessContext = await getBusinessContext(userId);

      // Check if web search is needed
      let webSearchResults = "";
      if (shouldSearchWeb(message)) {
        console.log("Performing web search for:", message);
        const searchData = await searchWeb(message);
        if (searchData && searchData.results.length > 0) {
          webSearchResults = `\n\nWEB SEARCH RESULTS:`;
          if (searchData.answer) {
            webSearchResults += `\nSummary: ${searchData.answer}\n`;
          }
          webSearchResults += `\nSources:`;
          searchData.results.forEach((result, i) => {
            webSearchResults += `\n${i + 1}. ${result.title}\n   URL: ${result.url}\n   ${result.content.slice(0, 200)}...`;
          });
        }
      }

      const contextMessage = `
CURRENT CONTEXT:
- Page: ${currentPage || 'Dashboard'}
${businessContext}
${webSearchResults}

USER MESSAGE: ${message}`;

      const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: SYSTEM_PROMPT },
        ...conversationHistory.slice(-10).map((msg: { role: string; content: string }) => ({
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
      
      const suggestions = getPageSuggestions(currentPage);
      res.json({ suggestions });
    } catch (error) {
      console.error("Error getting suggestions:", error);
      res.status(500).json({ error: "Failed to get suggestions" });
    }
  });
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
