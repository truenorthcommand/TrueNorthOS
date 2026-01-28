export const AI_CONFIG = {
  primaryModel: 'gpt-4o',
  fallbackModel: 'gpt-4-turbo-preview',
  maxCompletionTokens: 1024,
  requestTimeoutMs: 45000,
  maxRetries: 3,
};

let useFallback = false;

export function getModelWithFallback(): { model: string; isFallback: boolean } {
  return {
    model: useFallback ? AI_CONFIG.fallbackModel : AI_CONFIG.primaryModel,
    isFallback: useFallback,
  };
}

export function enableFallbackModel(): void {
  useFallback = true;
  console.log(`[AI Config] Switched to fallback model: ${AI_CONFIG.fallbackModel}`);
}

export function resetToDefaultModel(): void {
  useFallback = false;
}

export function isModelNotFoundError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('model not found') ||
      message.includes('does not exist') ||
      message.includes('invalid model') ||
      message.includes('model_not_found')
    );
  }
  return false;
}
