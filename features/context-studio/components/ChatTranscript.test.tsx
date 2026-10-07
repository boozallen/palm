import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import ChatTranscript, { type ChatMessageRecord } from './ChatTranscript';

function renderTranscript(messages: ChatMessageRecord[], userName: string | null = 'Test User') {
  return render(
    <MantineProvider theme={{ colorScheme: 'dark' }}>
      <ChatTranscript messages={messages} userName={userName} />
    </MantineProvider>,
  );
}

describe('ChatTranscript', () => {
  it('renders one bubble per message', () => {
    const messages: ChatMessageRecord[] = [
      {
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString(),
        usageSteps: [],
      },
      {
        role: 'assistant',
        content: 'Hi there',
        createdAt: new Date().toISOString(),
        usageSteps: [],
      },
      {
        role: 'user',
        content: 'How are you?',
        createdAt: new Date().toISOString(),
        usageSteps: [],
      },
    ];

    renderTranscript(messages);

    const bubbles = screen.getAllByTestId('chat-transcript-message');
    expect(bubbles).toHaveLength(3);
  });

  it('shows the cost breakdown when a message has recorded spend', () => {
    const messages: ChatMessageRecord[] = [
      {
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString(),
        usageSteps: [],
      },
      {
        role: 'assistant',
        content: 'Hi there',
        createdAt: new Date().toISOString(),
        usageSteps: [
          {
            stepLabel: 'response',
            cost: 0.0015,
            tokens: 150,
          },
        ],
      },
    ];

    renderTranscript(messages);

    expect(screen.getByTestId('chat-transcript-cost')).toBeInTheDocument();
  });

  it('omits the cost breakdown when no message has spend', () => {
    const messages: ChatMessageRecord[] = [
      {
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString(),
        usageSteps: [],
      },
      {
        role: 'assistant',
        content: 'Hi there',
        createdAt: new Date().toISOString(),
        usageSteps: [],
      },
    ];

    renderTranscript(messages);

    expect(screen.queryByTestId('chat-transcript-cost')).toBeNull();
  });
});
