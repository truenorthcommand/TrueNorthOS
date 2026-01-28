export interface TokenBudget {
  maxContextChars: number;
  maxConversationMessages: number;
  maxEntitiesPerType: number;
  maxWebResults: number;
}

export const DEFAULT_BUDGET: TokenBudget = {
  maxContextChars: 12000,
  maxConversationMessages: 10,
  maxEntitiesPerType: 25,
  maxWebResults: 3,
};

export function truncateToFit(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content;
  }
  const truncated = content.slice(0, maxChars - 20);
  const lastNewline = truncated.lastIndexOf('\n');
  if (lastNewline > maxChars * 0.8) {
    return truncated.slice(0, lastNewline) + '\n... (truncated)';
  }
  return truncated + '... (truncated)';
}

interface Message {
  role: string;
  content: string;
}

interface BuildBudgetedContextInput {
  businessContext: string;
  conversationHistory: Message[];
  webResults?: string;
}

interface BuildBudgetedContextOutput {
  context: string;
  conversationHistory: Message[];
  truncated: boolean;
}

export function buildBudgetedContext(
  parts: BuildBudgetedContextInput,
  budget: TokenBudget = DEFAULT_BUDGET
): BuildBudgetedContextOutput {
  let truncated = false;
  
  const limitedHistory = parts.conversationHistory.slice(-budget.maxConversationMessages);
  if (limitedHistory.length < parts.conversationHistory.length) {
    truncated = true;
  }

  let contextParts: string[] = [];
  let currentSize = 0;
  const maxContextChars = budget.maxContextChars;
  
  if (parts.businessContext) {
    const businessContextBudget = Math.floor(maxContextChars * 0.6);
    if (parts.businessContext.length > businessContextBudget) {
      contextParts.push(truncateToFit(parts.businessContext, businessContextBudget));
      truncated = true;
    } else {
      contextParts.push(parts.businessContext);
    }
    currentSize = contextParts[0].length;
  }

  if (parts.webResults) {
    const webResultsBudget = Math.floor(maxContextChars * 0.3);
    const remainingBudget = maxContextChars - currentSize;
    const actualBudget = Math.min(webResultsBudget, remainingBudget);
    
    if (parts.webResults.length > actualBudget) {
      contextParts.push(truncateToFit(parts.webResults, actualBudget));
      truncated = true;
    } else {
      contextParts.push(parts.webResults);
    }
  }

  const finalContext = contextParts.join('\n\n');
  
  if (finalContext.length > maxContextChars) {
    return {
      context: truncateToFit(finalContext, maxContextChars),
      conversationHistory: limitedHistory,
      truncated: true,
    };
  }

  return {
    context: finalContext,
    conversationHistory: limitedHistory,
    truncated,
  };
}

export function limitWebResults(results: any[], maxResults: number = DEFAULT_BUDGET.maxWebResults): any[] {
  return results.slice(0, maxResults);
}
