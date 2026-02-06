import { storage } from "../storage";
import type { Job, Client, Quote, Invoice } from "@shared/schema";

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

export interface WebSearchTriggerResult {
  shouldSearch: boolean;
  matchedPattern?: string;
}

export interface SearchResult {
  type: 'job' | 'client' | 'quote' | 'invoice';
  id: string;
  title: string;
  subtitle: string;
  status?: string;
}

const UK_TRADE_SUPPLIER_DOMAINS = [
  "screwfix.com",
  "toolstation.com",
  "cityplumbing.co.uk",
  "plumbase.co.uk",
  "wolseley.co.uk",
  "travis-perkins.co.uk",
  "wickes.co.uk",
  "cef.co.uk",
  "edmundson-electrical.co.uk",
  "tlc-direct.co.uk",
  "plumbworld.co.uk",
  "victorianplumbing.co.uk",
  "amazon.co.uk",
  "ebay.co.uk",
];

function enhanceSearchQuery(query: string): string {
  const lowerQuery = query.toLowerCase();
  
  const isProductSearch = [
    "price", "cost", "buy", "purchase", "where to get",
    "stockist", "supplier", "merchant", "wholesaler",
    "boiler", "radiator", "thermostat", "pump", "valve",
    "cable", "switch", "socket", "fuse", "circuit",
    "pipe", "fitting", "tap", "toilet", "sink",
    "copper", "solder", "flux", "tube", "wire",
    "connector", "coupling", "elbow", "tee", "bend"
  ].some(term => lowerQuery.includes(term));
  
  if (isProductSearch && !lowerQuery.includes("product page")) {
    return `${query} UK buy price`;
  }
  
  if (lowerQuery.includes("regulation") || lowerQuery.includes("bs 7671") || 
      lowerQuery.includes("gas safe") || lowerQuery.includes("part p")) {
    return `${query} UK official`;
  }
  
  return query;
}

function isProductSearch(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return [
    "price", "cost", "buy", "purchase", "where to get",
    "stockist", "supplier", "merchant", "wholesaler",
    "boiler", "radiator", "thermostat", "pump", "valve",
    "cable", "switch", "socket", "fuse", "circuit",
    "pipe", "fitting", "tap", "toilet", "sink",
    "copper", "solder", "flux", "tube", "wire",
    "connector", "coupling", "elbow", "tee", "bend"
  ].some(term => lowerQuery.includes(term));
}

export async function searchWeb(query: string): Promise<{ results: TavilySearchResult[]; answer?: string } | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.log("Tavily API key not configured");
    return null;
  }

  const enhancedQuery = enhanceSearchQuery(query);
  console.log("Enhanced search query:", enhancedQuery);

  try {
    const searchBody: Record<string, unknown> = {
      api_key: apiKey,
      query: enhancedQuery,
      search_depth: "advanced",
      include_answer: true,
      include_raw_content: false,
      max_results: 8,
    };

    if (isProductSearch(query)) {
      searchBody.include_domains = UK_TRADE_SUPPLIER_DOMAINS;
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(searchBody),
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

export function shouldSearchWeb(message: string): WebSearchTriggerResult {
  const lowerMessage = message.toLowerCase();
  
  const negativePatterns = [
    "show my",
    "my jobs",
    "my quotes",
    "my invoices",
    "my clients",
    "list my",
    "display my",
    "open my",
    "view my",
  ];
  
  if (negativePatterns.some(pattern => lowerMessage.includes(pattern))) {
    console.log("[Web Search] Skipped - matched negative pattern for internal data query");
    return { shouldSearch: false };
  }
  
  const recencyKeywords = [
    "latest",
    "recent",
    "news",
    "today",
    "this week",
    "current",
    "2024",
    "2025",
    "2026",
  ];
  
  const explicitSearchRequests = [
    "search for",
    "search the web",
    "look up",
    "find out about",
    "what is the",
    "google",
    "research online",
  ];
  
  const technicalTriggers = [
    "bs 7671",
    "gas safe",
    "building regs",
    "part p",
    "wiring regulations",
    "regulations",
    "specifications",
    "datasheet",
    "manufacturer",
  ];
  
  const supplierTriggers = [
    "where to buy",
    "supplier",
    "price of",
    "cost of",
    "stockist",
    "wholesaler",
    "trade counter",
    "plumbers merchant",
    "electrical wholesaler",
  ];
  
  for (const keyword of recencyKeywords) {
    if (lowerMessage.includes(keyword)) {
      console.log(`[Web Search] Triggered - recency keyword: "${keyword}"`);
      return { shouldSearch: true, matchedPattern: `recency:${keyword}` };
    }
  }
  
  for (const phrase of explicitSearchRequests) {
    if (lowerMessage.includes(phrase)) {
      console.log(`[Web Search] Triggered - explicit search request: "${phrase}"`);
      return { shouldSearch: true, matchedPattern: `explicit:${phrase}` };
    }
  }
  
  for (const term of technicalTriggers) {
    if (lowerMessage.includes(term)) {
      console.log(`[Web Search] Triggered - technical term: "${term}"`);
      return { shouldSearch: true, matchedPattern: `technical:${term}` };
    }
  }
  
  for (const term of supplierTriggers) {
    if (lowerMessage.includes(term)) {
      console.log(`[Web Search] Triggered - supplier term: "${term}"`);
      return { shouldSearch: true, matchedPattern: `supplier:${term}` };
    }
  }
  
  return { shouldSearch: false };
}

export async function searchEntities(query: string): Promise<SearchResult[]> {
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
