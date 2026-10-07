import type { IncomingHttpHeaders } from 'http';
import { z } from 'zod';

import { UsageAttribution } from '@/features/ai-provider/sources/AiProviderUsageTracker';

// chatMessageId, workflowExecutionId and documentId are uuid columns on
// AiProviderUsage. primitiveId and stepLabel are plain strings — a primitive id
// is a workflow node id such as 'step-llm', not a uuid.
const UUID_FIELDS = ['chatMessageId', 'workflowExecutionId', 'documentId'] as const;
const TEXT_FIELDS = ['primitiveId', 'stepLabel'] as const;

// Header names extend the x-user-id convention this proxy already uses. Node
// lowercases incoming header names, so these lookups are lowercase.
const HEADER_NAMES = {
  chatMessageId: 'x-chat-message-id',
  workflowExecutionId: 'x-workflow-execution-id',
  documentId: 'x-document-id',
  primitiveId: 'x-primitive-id',
  stepLabel: 'x-step-label',
} as const;

const UUID = z.string().uuid();

const _readString = (value: unknown): string | undefined => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

// Attribution is advisory metadata, so a malformed value is dropped rather than
// failing the caller's inference request. Invalid uuids in particular must be
// dropped: the usage insert would violate its column type, and
// AiProviderUsageTracker rethrows when the insert fails.
const _build = (read: (field: string) => unknown): UsageAttribution => {
  const attribution: UsageAttribution = {};

  for (const field of UUID_FIELDS) {
    const value = _readString(read(field));
    if (value && UUID.safeParse(value).success) {
      attribution[field] = value;
    }
  }

  for (const field of TEXT_FIELDS) {
    const value = _readString(read(field));
    if (value) {
      attribution[field] = value;
    }
  }

  return attribution;
};

export const parseUsageAttribution = (input: unknown): UsageAttribution => {
  if (typeof input !== 'object' || input === null) {
    return {};
  }

  const record = input as Record<string, unknown>;
  return _build((field) => record[field]);
};

export const parseUsageAttributionHeaders = (headers: IncomingHttpHeaders): UsageAttribution =>
  _build((field) => headers[HEADER_NAMES[field as keyof typeof HEADER_NAMES]]);

// AiProviderUsage.userId is a required uuid with a foreign key to User, and
// AiProviderUsageTracker rethrows when the insert fails. Callers that cannot
// name a real user must stay untracked instead of failing outright.
export const isTrackableUserId = (userId: string | undefined): userId is string =>
  typeof userId === 'string' && UUID.safeParse(userId).success;
