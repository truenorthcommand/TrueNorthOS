import { storage } from "../storage";

export interface SmartInsight {
  type: 'alert' | 'opportunity' | 'info';
  title: string;
  description: string;
  action?: string;
  actionPath?: string;
  priority: 'high' | 'medium' | 'low';
}

export async function getSmartInsights(): Promise<{ insights: SmartInsight[]; summary: { activeJobs: number; overdueInvoices: number; pendingQuotes: number; totalOutstanding: number } }> {
  try {
    const [jobs, invoices, quotes, clients] = await Promise.all([
      storage.getAllJobs(),
      storage.getAllInvoices(),
      storage.getAllQuotes(),
      storage.getAllClients(),
    ]);

    const insights: SmartInsight[] = [];
    const now = new Date();

    const activeJobs = jobs.filter(j => j.status !== 'Signed Off' && j.status !== 'Draft').length;
    
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

export async function getDynamicSuggestions(page: string): Promise<string[]> {
  try {
    const [jobs, invoices, quotes] = await Promise.all([
      storage.getAllJobs(),
      storage.getAllInvoices(),
      storage.getAllQuotes(),
    ]);

    const now = new Date();
    const dynamicSuggestions: string[] = [];

    const overdueInvoices = invoices.filter(inv => {
      if (inv.status === 'Paid' || inv.status === 'Draft') return false;
      if (!inv.dueDate) return false;
      return new Date(inv.dueDate) < now;
    });

    const activeJobs = jobs.filter(j => j.status === 'In Progress').length;
    const pendingQuotes = quotes.filter(q => q.status === 'Sent' || q.status === 'Pending').length;

    if (overdueInvoices.length > 0 && (page === 'dashboard' || page === 'invoices')) {
      dynamicSuggestions.push(`Review ${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? 's' : ''}`);
    }

    if (activeJobs > 0 && page === 'dashboard') {
      dynamicSuggestions.push(`Check progress on ${activeJobs} active job${activeJobs > 1 ? 's' : ''}`);
    }

    if (pendingQuotes > 0 && (page === 'dashboard' || page === 'quotes')) {
      dynamicSuggestions.push(`Follow up on ${pendingQuotes} pending quote${pendingQuotes > 1 ? 's' : ''}`);
    }

    const pageSuggestions = getPageSuggestions(page);
    
    return [...dynamicSuggestions, ...pageSuggestions].slice(0, 4);
  } catch (error) {
    console.error("Error generating dynamic suggestions:", error);
    return getPageSuggestions(page);
  }
}

export function getPageSuggestions(page: string): string[] {
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
