import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/router';

import Conversation from '@/pages/chat/[chatId]';
import useGetChat from '@/features/chat/api/get-chat';
import ChatInterface from '@/features/chat/components/ChatInterface';

let capturedChatInterfaceProps = {};

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/features/chat/components/ChatInterface', () => {
  const mockChatInterface = jest.fn((props) => {
    capturedChatInterfaceProps = { ...props };
    return <div>Chat Interface</div>;
  });
  return mockChatInterface;
});

jest.mock('@/features/chat/api/get-chat');

describe('pages/chat/[chatId]', () => {
  const mockPromptId = 'ae0306b7-cdef-4b5a-acae-490c3529df2b';
  const mockChatId = '92379158-4182-40b1-a266-26f177f05ec0';
  const mockModelId = '4a247524-b8aa-4323-8ea0-71f1d372907d';

  const mockChat = {
    chat: {
      id: mockChatId,
      promptId: mockPromptId,
      modelId: mockModelId,
      summary: 'Test summary',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capturedChatInterfaceProps = {};

    (useRouter as jest.Mock).mockReturnValue({
      query: {
        chatId: mockChatId,
      },
    });

    (useGetChat as jest.Mock).mockReturnValue({
      data: mockChat,
      isPending: false,
    });
  });

  it('should render ChatInterface component', () => {
    render(<Conversation />);

    expect(screen.getByText('Chat Interface')).toBeInTheDocument();
  });

  it('calls ChatInterface with chatId', () => {
    render(<Conversation />);

    expect(ChatInterface).toHaveBeenCalled();

    expect(capturedChatInterfaceProps).toEqual(
      expect.objectContaining({
        chatId: mockChatId,
      })
    );
  });

  it('calls ChatInterface with model id and prompt id from useGetChat response', () => {
    render(<Conversation />);

    expect(ChatInterface).toHaveBeenCalled();

    expect(capturedChatInterfaceProps).toEqual(
      expect.objectContaining({
        modelId: mockModelId,
        promptId: mockPromptId,
      })
    );
  });

  it('calls ChatInterface with null prompt', () => {
    (useGetChat as jest.Mock).mockReturnValue({
      data: {
        chat: {
          ...mockChat.chat,
          promptId: null,
        },
      },
      isPending: false,
    });

    render(<Conversation />);

    expect(ChatInterface).toHaveBeenCalled();

    expect(capturedChatInterfaceProps).toEqual(
      expect.objectContaining({
        promptId: null,
      })
    );
  });
});
