import { retryWithBackoff } from './retryWithBackoff';
import { RateLimitExceededError, TransientConnectionError } from '@/features/ai-provider/sources/errors';

jest.mock('@/server/logger');

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return result on first try success', async () => {
    const fn = jest.fn().mockResolvedValue('success');

    const resultPromise = retryWithBackoff(fn);
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on RateLimitExceededError and succeed', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new RateLimitExceededError('Rate limited'))
      .mockRejectedValueOnce(new RateLimitExceededError('Rate limited'))
      .mockResolvedValueOnce('success');

    const resultPromise = retryWithBackoff(fn, { initialDelayMs: 100 });

    // First attempt fails, wait for first delay
    await jest.advanceTimersByTimeAsync(100);
    // Second attempt fails, wait for second delay (200ms with 2x backoff)
    await jest.advanceTimersByTimeAsync(200);

    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should retry on TransientConnectionError and succeed', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new TransientConnectionError('Connection error (ECONNRESET)', 'ECONNRESET'))
      .mockResolvedValueOnce('success');

    const resultPromise = retryWithBackoff(fn, { initialDelayMs: 100 });

    // First attempt fails, wait for first delay
    await jest.advanceTimersByTimeAsync(100);

    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw immediately on non-retryable errors', async () => {
    const genericError = new Error('Generic error');
    const fn = jest.fn().mockRejectedValue(genericError);

    await expect(retryWithBackoff(fn)).rejects.toThrow('Generic error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw after max retries exceeded', async () => {
    jest.useRealTimers(); // Use real timers for this test

    const fn = jest.fn().mockRejectedValue(new RateLimitExceededError('Rate limited'));

    await expect(
      retryWithBackoff(fn, { maxRetries: 2, initialDelayMs: 10, maxDelayMs: 20 })
    ).rejects.toThrow('Rate limited');

    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should respect maxDelayMs cap', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new RateLimitExceededError('Rate limited'))
      .mockRejectedValueOnce(new RateLimitExceededError('Rate limited'))
      .mockRejectedValueOnce(new RateLimitExceededError('Rate limited'))
      .mockResolvedValueOnce('success');

    const resultPromise = retryWithBackoff(fn, {
      initialDelayMs: 1000,
      maxDelayMs: 2000,
      backoffMultiplier: 3,
    });

    // First delay: 1000ms
    await jest.advanceTimersByTimeAsync(1000);
    // Second delay: min(3000, 2000) = 2000ms
    await jest.advanceTimersByTimeAsync(2000);
    // Third delay: min(6000, 2000) = 2000ms
    await jest.advanceTimersByTimeAsync(2000);

    const result = await resultPromise;
    expect(result).toBe('success');
  });
});
