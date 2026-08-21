export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

export class ModelNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelNotFoundError';
    Object.setPrototypeOf(this, ModelNotFoundError.prototype);
  }
}

/**
 * Base class for errors that should trigger retry logic.
 * Used by retryWithBackoff to determine if an error is transient.
 */
export class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableError';
    Object.setPrototypeOf(this, RetryableError.prototype);
  }
}

export class RateLimitExceededError extends RetryableError {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitExceededError';
    Object.setPrototypeOf(this, RateLimitExceededError.prototype);
  }
}

/**
 * Transient connection errors that may succeed on retry.
 * Examples: ECONNRESET, ETIMEDOUT, ERR_HTTP2_STREAM_CANCEL
 */
export class TransientConnectionError extends RetryableError {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'TransientConnectionError';
    Object.setPrototypeOf(this, TransientConnectionError.prototype);
  }
}
