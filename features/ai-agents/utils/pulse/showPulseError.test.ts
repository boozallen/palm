import { notifications } from '@mantine/notifications';

import showPulseError from '@/features/ai-agents/utils/pulse/showPulseError';
import {
  fallbackIsAllowedValueError,
  formatPulseError,
  queueUnavailableError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';

jest.mock('@mantine/notifications', () => ({
  notifications: { show: jest.fn() },
}));

const mockShow = jest.mocked(notifications.show);

describe('showPulseError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the cause as the title and the fix as the message', () => {
    showPulseError(new Error(formatPulseError(queueUnavailableError())), 'Could not start the analysis');

    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({
      title: 'The analysis queue isn\'t running.',
      message: 'Try again in a few minutes; if it persists, ask an admin.',
      color: 'red',
    }));
  });

  it('uses the fallback title and the whole message when there is no fix', () => {
    showPulseError(new Error('Network error'), 'Could not start the analysis');

    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Could not start the analysis',
      message: 'Network error',
    }));
  });

  it('reads the first issue out of a rejected tRPC input', () => {
    const issues = [
      {
        code: 'custom',
        path: ['fields', 0, 'defaultValue'],
        message: formatPulseError(fallbackIsAllowedValueError('Sentiment', 'Negative')),
      },
      { code: 'custom', path: ['fields', 1], message: 'A second issue.' },
    ];

    showPulseError(new Error(JSON.stringify(issues, null, 2)), 'Could not start the analysis');

    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({
      title: '\'Sentiment\' lists "Negative" as an allowed value.',
      message: 'Remove it — PULSE uses it for answers it can\'t determine.',
    }));
  });

  it('accepts a plain string', () => {
    showPulseError(formatPulseError(queueUnavailableError()), 'Could not start the analysis');

    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ title: 'The analysis queue isn\'t running.' }));
  });

  it('still shows something for a value that is not an error', () => {
    showPulseError({ unexpected: true }, 'Could not start the analysis');

    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Could not start the analysis',
      message: 'Try again.',
    }));
  });
});
