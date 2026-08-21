import { logger } from '@/server/logger';
import { RetryableError } from '@/features/ai-provider/sources/errors';

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 4,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Execute a function with exponential backoff retry on retryable errors.
 * Retries on: RateLimitExceededError, TransientConnectionError, and any RetryableError subclass.
 * Non-retryable errors are thrown immediately without retry.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = opts.initialDelayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!(error instanceof RetryableError)) {
        throw error; // Non-retryable errors fail immediately
      }

      lastError = error;

      if (attempt === opts.maxRetries) {
        logger.error('[RETRY] Max retries exceeded', {
          attempts: attempt + 1,
          finalDelay: delay,
          errorType: error.name,
        });
        break;
      }

      logger.warn('[RETRY] Retryable error, backing off', {
        attempt: attempt + 1,
        delayMs: delay,
        errorType: error.name,
      });

      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
