import { debug, error } from './logger';

/**
 * Retry wrapper for resilient API calls and operations
 * Handles transient failures gracefully
 */
export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 1.5,
  onRetry: () => {}, // no-op
};

/**
 * Execute a function with automatic retry logic
 * @param fn Function to execute
 * @param options Retry configuration
 * @returns Result of the function
 * @throws Error if all attempts fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = config.delayMs;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      debug(`[Retry] Attempt ${attempt}/${config.maxAttempts}`);
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === config.maxAttempts) {
        // Final attempt failed
        error(
          `[Retry] Failed after ${config.maxAttempts} attempts:`,
          lastError
        );
        throw lastError;
      }

      // Call retry callback
      config.onRetry(attempt, lastError);

      debug(
        `[Retry] Attempt ${attempt} failed, waiting ${delay}ms before retry...`
      );
      await new Promise((r) => setTimeout(r, delay));

      // Increase delay for next attempt (exponential backoff)
      delay = Math.floor(delay * config.backoffMultiplier);
    }
  }

  // Should never reach here
  throw lastError || new Error('Retry exhausted');
}

/**
 * Common retry configuration for API calls
 */
export const RetryConfig = {
  AGGRESSIVE: { maxAttempts: 5, delayMs: 500, backoffMultiplier: 1.5 } as RetryOptions,
  NORMAL: { maxAttempts: 3, delayMs: 1000, backoffMultiplier: 1.5 } as RetryOptions,
  CONSERVATIVE: { maxAttempts: 2, delayMs: 2000, backoffMultiplier: 1.5 } as RetryOptions,
} as const;
