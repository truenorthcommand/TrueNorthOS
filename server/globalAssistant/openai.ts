import OpenAI from "openai";
import { isModelNotFoundError } from "./config";

export function getOpenAIClient(): OpenAI | null {
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

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('429') || message.includes('rate limit')) {
      return "The AI service is busy. Please try again in a moment.";
    }
    
    if (message.includes('timeout') || message.includes('timed out') ||
        message.includes('etimedout') || message.includes('deadline')) {
      return "The request took too long. Try asking a simpler question.";
    }
    
    if (message.includes('context') && message.includes('long') ||
        message.includes('maximum context') || message.includes('token limit')) {
      return "Your conversation is getting long. Start a new chat for best results.";
    }
    
    if (isModelNotFoundError(error)) {
      return "There was an issue with the AI service. Please try again.";
    }
    
    if (message.includes('500') || message.includes('502') ||
        message.includes('503') || message.includes('504')) {
      return "There was an issue with the AI service. Please try again.";
    }
  }
  
  return "There was an issue processing your request. Please try again.";
}
