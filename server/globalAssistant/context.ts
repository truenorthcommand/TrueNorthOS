import { storage } from "../storage";
import type { Job, Client, Quote, Invoice } from "@shared/schema";

export type ContextIntent = 'chat' | 'insights' | 'suggestions' | 'search';

const HARD_CAPS = {
  maxJobs: 25,
  maxClients: 25,
  maxQuotes: 50,
  maxInvoices: 50,
};

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

async function getChatContext(userId: string): Promise<string> {
  try {
    const [activeJobs, recentJobs, recentClients, quotes, invoices, user, learnedPatterns, userPreferences] = await Promise.all([
      storage.getActiveJobs(),
      storage.getRecentJobs(HARD_CAPS.maxJobs),
      storage.getRecentClients(HARD_CAPS.maxClients),
      storage.getAllQuotes().then(q => q.slice(0, HARD_CAPS.maxQuotes)),
      storage.getAllInvoices().then(i => i.slice(0, HARD_CAPS.maxInvoices)),
      storage.getUser(userId),
      getLearnedPatterns(),
      getUserPreferenceContext(userId),
    ]);

    const pendingQuotes = quotes.filter((q: Quote) => q.status === 'pending' || q.status === 'sent');
    const unpaidInvoices = invoices.filter((i: Invoice) => i.status === 'sent' || i.status === 'overdue');
    const overdueInvoices = invoices.filter((i: Invoice) => i.status === 'overdue');
    const totalUnpaid = unpaidInvoices.reduce((sum: number, inv: Invoice) => sum + Number(inv.total || 0), 0);

    return `
BUSINESS SUMMARY:
- Total Clients: ${recentClients.length}+
- Active Jobs: ${activeJobs.length}
- Pending Quotes: ${pendingQuotes.length}
- Unpaid Invoices: ${unpaidInvoices.length} (£${totalUnpaid.toLocaleString()})
- Overdue Invoices: ${overdueInvoices.length}

USER: ${user?.name || 'Unknown'} (${user?.role || 'user'})

RECENT ACTIVE JOBS:
${activeJobs.slice(0, 5).map((j: Job) => `- #${j.jobNo}: ${j.nickname || j.customerName} - ${j.status}`).join('\n')}

RECENT CLIENTS:
${recentClients.slice(0, 5).map((c: Client) => `- #${c.id}: ${c.name} - ${c.email || 'no email'}`).join('\n')}

RECENT QUOTES:
${quotes.slice(0, 5).map((q: Quote) => `- #${q.quoteNo || q.id}: £${q.total} - ${q.status}`).join('\n')}

RECENT INVOICES:
${invoices.slice(0, 5).map((i: Invoice) => `- #${i.invoiceNo || i.id}: £${i.total} - ${i.status}`).join('\n')}
${learnedPatterns}${userPreferences}
`;
  } catch (error) {
    console.error("Error fetching chat context:", error);
    return "Unable to fetch business data at this time.";
  }
}

async function getInsightsContext(): Promise<string> {
  try {
    const [jobStats, invoiceStats, quoteStats] = await Promise.all([
      storage.getJobStats(),
      storage.getInvoiceStats(),
      storage.getQuoteStats(),
    ]);

    return `
BUSINESS STATS (aggregated):
- Active Jobs: ${jobStats.active}
- Completed Jobs: ${jobStats.completed}
- Pending Jobs: ${jobStats.pending}
- Unpaid Invoices: ${invoiceStats.unpaid} (£${invoiceStats.totalUnpaid.toLocaleString()})
- Overdue Invoices: ${invoiceStats.overdue}
- Pending Quotes: ${quoteStats.pending}
- Sent Quotes: ${quoteStats.sent}
`;
  } catch (error) {
    console.error("Error fetching insights context:", error);
    return "Unable to fetch business stats at this time.";
  }
}

async function getSuggestionsContext(): Promise<string> {
  try {
    const [jobStats, invoiceStats, quoteStats] = await Promise.all([
      storage.getJobStats(),
      storage.getInvoiceStats(),
      storage.getQuoteStats(),
    ]);

    return `Active: ${jobStats.active} jobs, ${invoiceStats.overdue} overdue invoices, ${quoteStats.pending + quoteStats.sent} pending quotes`;
  } catch (error) {
    console.error("Error fetching suggestions context:", error);
    return "";
  }
}

export async function getBoundedBusinessContext(userId: string, intent: ContextIntent): Promise<string> {
  switch (intent) {
    case 'chat':
      return getChatContext(userId);
    case 'insights':
      return getInsightsContext();
    case 'suggestions':
      return getSuggestionsContext();
    case 'search':
      return "";
    default:
      return getChatContext(userId);
  }
}

export async function getBusinessStats(): Promise<{
  jobStats: { active: number; completed: number; pending: number };
  invoiceStats: { unpaid: number; overdue: number; totalUnpaid: number };
  quoteStats: { pending: number; sent: number };
}> {
  const [jobStats, invoiceStats, quoteStats] = await Promise.all([
    storage.getJobStats(),
    storage.getInvoiceStats(),
    storage.getQuoteStats(),
  ]);
  return { jobStats, invoiceStats, quoteStats };
}
