import { fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import { notifications } from '@mantine/notifications';

import ChatForm from './ChatForm';
import { useChat } from '@/features/chat/providers/ChatProvider';
import useCreateChat from '@/features/chat/api/create-chat';
import useAddMessage from '@/features/chat/api/add-message';
import useGetOriginPrompt from '@/features/chat/api/get-origin-prompt';
import useUpdateChatConversationSummary from '@/features/chat/api/update-chat-conversation-summary';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import { renderWrapper } from '@/test/test-utils';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('@mantine/notifications');

jest.mock('@/features/chat/providers/ChatProvider');
jest.mock('@/features/chat/api/create-chat');
jest.mock('@/features/chat/api/add-message');
jest.mock('@/features/chat/api/get-origin-prompt');
jest.mock('@/features/chat/api/update-chat-conversation-summary');
jest.mock('@/features/shared/api/get-available-models', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('ChatForm', () => {
  const mockUseChat = {
    chatId: null,
    modelId: 'b6185671-e27f-4f69-8647-987176d96e66',
    promptId: '1f68f2a6-71f3-4ff5-8501-ecf15847c055',
    setChatId: jest.fn(),
    pendingMessage: null,
    setPendingMessage: jest.fn(),
    isLastMessageRetry: false,
    knowledgeBaseIds: [],
    documentLibraryEnabled: true,
  };

  const mockChatId = '22acee37-f309-41e5-a7a9-5e1abc6c4587';
  const mockPromptExample = 'example input';
  const mockMessage = 'test message';

  const mockRouter = {
    replace: jest.fn(),
    push: jest.fn(),
    events: {
      on: jest.fn(),
      off: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useChat as jest.Mock).mockReturnValue(mockUseChat);
    (useCreateChat as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({ chat: { id: mockChatId } }),
      isPending: false,
    });
    (useAddMessage as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
      isPending: false,
    });
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useGetOriginPrompt as jest.Mock).mockReturnValue({
      isPending: false,
      isFetched: true,
      data: { prompt: { example: mockPromptExample } },
    });
    (useUpdateChatConversationSummary as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
    });
    (useGetAvailableModels as jest.Mock).mockReturnValue({
      data: {
        availableModels: [{
          id: 'ceb3104c-a1a1-4ce0-b433-a3cfdc1be7bf',
          name: 'model-name',
        }],
      },
      isPending: false,
    });
  });

  it('renders without crashing', () => {
    const { container } = renderWrapper(<ChatForm />);
    expect(container).toBeTruthy();
  });

  it('submits the form and creates a new chat', async () => {
    const { getByRole } = renderWrapper(<ChatForm />);
    const input = getByRole('textbox');
    const submitButton = getByRole('button', { name: /send/i });

    fireEvent.change(input, { target: { value: mockMessage } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUseChat.setPendingMessage).toHaveBeenCalledWith(mockMessage);
      expect(useCreateChat().mutateAsync).toHaveBeenCalledWith({
        modelId: mockUseChat.modelId,
        promptId: mockUseChat.promptId,
      });
      expect(useAddMessage().mutateAsync).toHaveBeenCalledWith({
        chatId: mockChatId,
        message: mockMessage,
        knowledgeBaseIds: [],
        documentLibraryEnabled: true,
      });
      expect(mockUseChat.setChatId).toHaveBeenCalledWith(mockChatId);
      expect(mockUseChat.setPendingMessage).toHaveBeenCalledWith(null);
    });
  });

  it('sets the prompt example to the text input if there is one', () => {
    const { getByDisplayValue } = renderWrapper(<ChatForm />);
    expect(getByDisplayValue(mockPromptExample)).toBeInTheDocument();
  });

  it('shows a notification if there is an error', async () => {
    (useCreateChat as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockRejectedValue(new Error('Error creating chat')),
      isPending: false,
    });

    const { getByRole } = renderWrapper(<ChatForm />);
    const input = getByRole('textbox');
    const submitButton = getByRole('button', { name: /send/i });

    fireEvent.change(input, { target: { value: mockMessage } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Failed to Add Message to Chat',
        message: 'An unexpected error occurred. Please try again later.',
        icon: expect.any(Object),
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    });
  });

  it('disables the submit button when pending', () => {
    (useCreateChat as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: true,
    });

    const { getByRole } = renderWrapper(<ChatForm />);
    const submitButton = getByRole('button', { name: /send/i });

    expect(submitButton).toBeDisabled();
  });
});
