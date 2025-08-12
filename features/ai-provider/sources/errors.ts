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

export class RateLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitExceededError';
    Object.setPrototypeOf(this, RateLimitExceededError.prototype);
  }
}
