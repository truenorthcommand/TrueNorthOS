import { AI_CONFIG } from "./config";

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: AI_CONFIG.maxRetries,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('429') || message.includes('rate limit')) {
      return true;
    }
    
    if (message.includes('500') || message.includes('502') || 
        message.includes('503') || message.includes('504') ||
        message.includes('internal server error') ||
        message.includes('service unavailable')) {
      return true;
    }
    
    if (message.includes('timeout') || message.includes('timed out') ||
        message.includes('etimedout') || message.includes('esockettimedout')) {
      return true;
    }
    
    if (message.includes('econnreset') || message.includes('econnrefused') ||
        message.includes('network') || message.includes('socket hang up')) {
      return true;
    }
  }
  
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    const status = err.status || err.statusCode;
    if (typeof status === 'number') {
      if (status === 429 || (status >= 500 && status < 600)) {
        return true;
      }
    }
  }
  
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateDelay(attempt: number, options: RetryOptions): number {
  const delay = options.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * delay;
  return Math.min(delay + jitter, options.maxDelayMs);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
  isRetryable?: (error: unknown) => boolean
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const shouldRetry = isRetryable || isRetryableError;
  
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < opts.maxRetries && shouldRetry(error)) {
        const delay = calculateDelay(attempt, opts);
        console.log(`[Retry] Attempt ${attempt + 1}/${opts.maxRetries} failed, retrying in ${Math.round(delay)}ms`);
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
  
  throw lastError;
}
