import {
  AuthenticationError,
  AuthorizationError,
  ModelNotFoundError,
  RetryableError,
} from '@/features/ai-provider/sources/errors';
import {
  modelAccessError,
  modelBusyError,
  modelFilteredError,
  modelInputTooLongError,
  modelUnknownError,
  type PulseError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';

type ModelErrorCategory = 'busy' | 'access' | 'tooLong' | 'filtered' | 'unknown';

type ModelErrorContext = {
  modelName: string;
  // The output columns the failed call was deriving, named in the too-long fix.
  fieldNames: string[];
};

export type ClassifiedModelError = {
  category: ModelErrorCategory;
  // Only a busy endpoint is worth another call; everything else fails the same way again.
  retryable: boolean;
  error: PulseError;
};

const TOO_LONG_TEXT = /too long|too large|context length|context window|maximum context|too many (input )?tokens|token limit|context_length_exceeded|exceeds the maximum/i;
const FILTERED_TEXT = /content filter|content_filter|content management policy|responsible ai|safety (system|filter|settings)|blocked by|guardrail/i;
const BUSY_TEXT = /timed? ?out|throttl|rate limit|too many requests|overloaded|service unavailable|temporarily unavailable|ETIMEDOUT|ECONNRESET/i;
const ACCESS_TEXT = /access denied|not authori[sz]ed|unauthori[sz]ed|forbidden|permission|credentials|invalid api key/i;

type StatusCarrier = {
  status?: unknown;
  statusCode?: unknown;
  $metadata?: { httpStatusCode?: unknown };
};

function statusOf(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const carrier = error as StatusCarrier;
  const candidates = [carrier.status, carrier.statusCode, carrier.$metadata?.httpStatusCode];
  const status = candidates.find((candidate) => typeof candidate === 'number');

  return typeof status === 'number' ? status : null;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '';
}

function textOf(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? error.cause.message : '';
    return [error.name, error.message, cause].join(' ');
  }
  return messageOf(error);
}

function classified(category: ModelErrorCategory, error: PulseError): ClassifiedModelError {
  return { category, retryable: category === 'busy', error };
}

// Most provider sources rewrap errors into fixed messages, so error classes and status codes
// decide first; the text patterns catch the providers that pass the original message through.
export default function classifyModelError(
  error: unknown,
  context: ModelErrorContext,
): ClassifiedModelError {
  const status = statusOf(error);
  const text = textOf(error);

  if (error instanceof RetryableError) {
    return classified('busy', modelBusyError());
  }
  if (status === 413 || TOO_LONG_TEXT.test(text)) {
    return classified('tooLong', modelInputTooLongError(context.modelName, context.fieldNames));
  }
  if (FILTERED_TEXT.test(text)) {
    return classified('filtered', modelFilteredError(context.modelName));
  }
  if (status === 408 || status === 429 || (status !== null && status >= 500) || BUSY_TEXT.test(text)) {
    return classified('busy', modelBusyError());
  }

  const isAccessError = error instanceof AuthenticationError
    || error instanceof AuthorizationError
    || error instanceof ModelNotFoundError;

  if (isAccessError || status === 401 || status === 403 || status === 404 || ACCESS_TEXT.test(text)) {
    return classified('access', modelAccessError(context.modelName));
  }

  return classified('unknown', modelUnknownError(context.modelName, messageOf(error)));
}
