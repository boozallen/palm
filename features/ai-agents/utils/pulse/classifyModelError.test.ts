import classifyModelError from '@/features/ai-agents/utils/pulse/classifyModelError';
import {
  modelAccessError,
  modelBusyError,
  modelFilteredError,
  modelInputTooLongError,
  modelUnknownError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';
import {
  AuthenticationError,
  AuthorizationError,
  ModelNotFoundError,
  RateLimitExceededError,
  TransientConnectionError,
} from '@/features/ai-provider/sources/errors';

const context = { modelName: 'Claude Sonnet', fieldNames: ['Sentiment'] };

function withStatus(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

describe('classifyModelError', () => {
  it('treats a dropped connection or timeout as busy and retryable', () => {
    const result = classifyModelError(new TransientConnectionError('socket hang up', 'ETIMEDOUT'), context);

    expect(result).toEqual({ category: 'busy', retryable: true, error: modelBusyError() });
  });

  it('treats a rate limit as busy and retryable', () => {
    const result = classifyModelError(new RateLimitExceededError('throttled'), context);

    expect(result.category).toBe('busy');
    expect(result.retryable).toBe(true);
  });

  it('treats a 429 or 5xx status as busy', () => {
    expect(classifyModelError(withStatus('slow down', 429), context).category).toBe('busy');
    expect(classifyModelError(withStatus('upstream failed', 503), context).category).toBe('busy');
  });

  it('treats provider text about timeouts or throttling as busy', () => {
    expect(classifyModelError(new Error('Bedrock timeout'), context).category).toBe('busy');
    expect(classifyModelError(new Error('ThrottlingException: Rate exceeded'), context).category).toBe('busy');
  });

  it('names the model the user lacks access to', () => {
    const result = classifyModelError(new AuthorizationError('denied'), context);

    expect(result).toEqual({ category: 'access', retryable: false, error: modelAccessError('Claude Sonnet') });
  });

  it('treats bad credentials, a missing model, or a 403 as access', () => {
    expect(classifyModelError(new AuthenticationError('bad key'), context).category).toBe('access');
    expect(classifyModelError(new ModelNotFoundError('Invalid model specified for Bedrock'), context).category)
      .toBe('access');
    expect(classifyModelError(Object.assign(new Error('nope'), { $metadata: { httpStatusCode: 403 } }), context).category)
      .toBe('access');
  });

  it('names the output columns a too-long response was sent for', () => {
    const result = classifyModelError(new Error('Gemini 400: Input is too long for requested model.'), {
      modelName: 'Gemini Pro',
      fieldNames: ['Sentiment', 'Theme'],
    });

    expect(result).toEqual({
      category: 'tooLong',
      retryable: false,
      error: modelInputTooLongError('Gemini Pro', ['Sentiment', 'Theme']),
    });
  });

  it('treats a 413 status as too long', () => {
    expect(classifyModelError(withStatus('Payload rejected', 413), context).category).toBe('tooLong');
  });

  it('treats a content filter refusal as filtered', () => {
    const error = new Error('The response was filtered due to the prompt triggering the content management policy.');
    const result = classifyModelError(error, context);

    expect(result).toEqual({ category: 'filtered', retryable: false, error: modelFilteredError('Claude Sonnet') });
  });

  it('passes an unrecognized error message through', () => {
    const result = classifyModelError(new Error('malformed request'), context);

    expect(result).toEqual({
      category: 'unknown',
      retryable: false,
      error: modelUnknownError('Claude Sonnet', 'malformed request'),
    });
  });

  it('treats a non-error value as unknown', () => {
    expect(classifyModelError('nope', context).error).toEqual(modelUnknownError('Claude Sonnet', 'nope'));
    expect(classifyModelError({ weird: true }, context).error).toEqual(modelUnknownError('Claude Sonnet', ''));
  });
});
