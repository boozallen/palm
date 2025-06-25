import { screen } from '@testing-library/react';
import ChatHistory from './ChatHistory';
import { renderWrapper } from '@/test/test-utils';
import useGetChats from '@/features/chat/api/get-chats';
import { useDeleteChat } from '@/features/chat/api/delete-chat';

jest.mock('@/features/chat/api/get-chats');
jest.mock('@/features/chat/api/delete-chat');
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

const mockChatConversations = {
  chats: [
    {
      id: 'convo-1',
      aiProvider: 1,
      summary: 'Mock conversation 1',
      userId: 'user-123',
      promptId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'convo-2',
      aiProvider: 1,
      summary: 'Mock conversation 2',
      userId: 'user-456',
      promptId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'convo-3',
      aiProvider: 1,
      summary: 'Mock conversation 3',
      userId: 'user-789',
      promptId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

describe('ChatHistory', () => {
  beforeEach(() => {
    (useGetChats as jest.Mock).mockReturnValue({
      data: mockChatConversations,
      isPending: false,
      error: null,
    });

    (useDeleteChat as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders conversations', () => {
    renderWrapper(<ChatHistory />);

    mockChatConversations.chats.forEach((conversation) => {
      expect(screen.getByText(conversation.summary)).toBeInTheDocument();
    });
  });
});
