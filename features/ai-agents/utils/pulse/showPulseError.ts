import { createElement } from 'react';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import { parsePulseErrorMessage } from '@/features/ai-agents/utils/pulse/pulseErrors';

const EMPTY_MESSAGE_BODY = 'Try again.';

// A tRPC input rejection arrives as the JSON of zod's issues array; the first issue is the one to show.
function firstIssueMessage(raw: string): string | null {
  if (!raw.trimStart().startsWith('[')) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }

    const first: unknown = parsed[0];

    if (typeof first === 'object' && first !== null && 'message' in first && typeof first.message === 'string') {
      return first.message;
    }

    return null;
  } catch {
    return null;
  }
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

export default function showPulseError(error: unknown, fallbackTitle: string): void {
  const raw = messageOf(error);
  const message = firstIssueMessage(raw) ?? raw;
  const { cause, fix } = parsePulseErrorMessage(message);

  notifications.show({
    title: fix ? cause : fallbackTitle,
    message: fix ?? (message.trim().length > 0 ? message : EMPTY_MESSAGE_BODY),
    icon: createElement(IconX),
    color: 'red',
  });
}
