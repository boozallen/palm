import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import FollowUpQuestions from './FollowUpQuestions';
import { ChatMessageFollowUp } from '@/features/chat/types/message';

// Mock the chat provider
const mockUseChat = {
  chatId: 'test-chat-id' as string | null,
  modelId: 'test-model-id' as string | null,
  pendingMessage: null as string | null,
  setPendingMessage: jest.fn(),
  knowledgeBaseIds: ['kb1', 'kb2'],
  documentLibraryEnabled: true,
};

const mockAddMessage = {
  mutateAsync: jest.fn(),
  isPending: false,
};

jest.mock('@/features/chat/providers/ChatProvider', () => ({
  useChat: () => mockUseChat,
}));

jest.mock('@/features/chat/api/add-message', () => {
  return () => mockAddMessage;
});

jest.mock('@mantine/notifications');

describe('FollowUpQuestions', () => {
  const stubFollowUpQuestions: ChatMessageFollowUp[] = [
    {
      id: '1',
      chatMessageId: 'msg-1',
      content: 'What is the weather like today?',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      chatMessageId: 'msg-1',
      content: 'How can I improve my productivity?',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock values to defaults
    mockUseChat.chatId = 'test-chat-id';
    mockUseChat.modelId = 'test-model-id';
    mockUseChat.pendingMessage = null;
    mockAddMessage.isPending = false;
    mockAddMessage.mutateAsync.mockResolvedValue({});
  });

  describe('Rendering', () => {
    it('returns null when no follow-up questions are provided', () => {
      const { container } = render(<FollowUpQuestions />);
      expect(container).toBeEmptyDOMElement();
    });

    it('returns null when follow-up questions array is empty', () => {
      const { container } = render(<FollowUpQuestions followUpQuestions={[]} />);
      expect(container).toBeInTheDocument();
    });

    it('renders follow-up questions when provided', () => {
      render(<FollowUpQuestions followUpQuestions={stubFollowUpQuestions} />);

      expect(screen.getByText('Follow Up Questions:')).toBeInTheDocument();
      expect(screen.getByText('What is the weather like today?')).toBeInTheDocument();
      expect(screen.getByText('How can I improve my productivity?')).toBeInTheDocument();
    });

    it('displays the correct number of question buttons', () => {
      render(<FollowUpQuestions followUpQuestions={stubFollowUpQuestions} />);

      const questionButtons = screen.getAllByRole('button');
      expect(questionButtons).toHaveLength(2);
    });
  });

  describe('Button State', () => {
    it('disables buttons when addMessage is pending', () => {
      mockAddMessage.isPending = true;
      render(<FollowUpQuestions followUpQuestions={stubFollowUpQuestions} />);

      const questionButtons = screen.getAllByRole('button');
      questionButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    it('disables buttons when modelId is null', () => {
      mockUseChat.modelId = null;
      render(<FollowUpQuestions followUpQuestions={stubFollowUpQuestions} />);

      const questionButtons = screen.getAllByRole('button');
      questionButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    it('disables buttons when pendingMessage is not null', () => {
      mockUseChat.pendingMessage = 'Test pending message';
      render(<FollowUpQuestions followUpQuestions={stubFollowUpQuestions} />);

      const questionButtons = screen.getAllByRole('button');
      questionButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    it('enables buttons when all conditions are met', () => {
      render(<FollowUpQuestions followUpQuestions={stubFollowUpQuestions} />);

      const questionButtons = screen.getAllByRole('button');
      questionButtons.forEach(button => {
        expect(button).not.toBeDisabled();
      });
    });
  });

  describe('Click Handler', () => {
    it('sets pending message when question is clicked', async () => {
      render(<FollowUpQuestions followUpQuestions={stubFollowUpQuestions} />);

      const firstQuestionButton = screen.getByText('What is the weather like today?');
      fireEvent.click(firstQuestionButton);

      expect(mockUseChat.setPendingMessage).toHaveBeenCalledWith('What is the weather like today?');
    });

    it('calls addMessage with correct parameters', async () => {
      render(<FollowUpQuestions followUpQuestions={stubFollowUpQuestions} />);

      const firstQuestionButton = screen.getByText('What is the weather like today?');
      fireEvent.click(firstQuestionButton);

      await waitFor(() => {
        expect(mockAddMessage.mutateAsync).toHaveBeenCalledWith({
          chatId: 'test-chat-id',
          message: 'What is the weather like today?',
          knowledgeBaseIds: ['kb1', 'kb2'],
          documentLibraryEnabled: true,
        });
      });
    });

    it('clears pending message after successful submission', async () => {
      render(<FollowUpQuestions followUpQuestions={stubFollowUpQuestions} />);

      const firstQuestionButton = screen.getByText('What is the weather like today?');
      fireEvent.click(firstQuestionButton);

      await waitFor(() => {
        expect(mockUseChat.setPendingMessage).toHaveBeenCalledWith(null);
      });
    });

    it('does nothing when pendingMessage is already set', async () => {
      mockUseChat.pendingMessage = 'Existing pending message';
      render(<FollowUpQuestions followUpQuestions={stubFollowUpQuestions} />);

      const firstQuestionButton = screen.getByText('What is the weather like today?');
      fireEvent.click(firstQuestionButton);

      expect(mockAddMessage.mutateAsync).not.toHaveBeenCalled();
    });

    it('does nothing when modelId is null', async () => {
      mockUseChat.modelId = null;
      render(<FollowUpQuestions followUpQuestions={stubFollowUpQuestions} />);

      const firstQuestionButton = screen.getByText('What is the weather like today?');
      fireEvent.click(firstQuestionButton);

      expect(mockAddMessage.mutateAsync).not.toHaveBeenCalled();
    });

    it('returns early when chatId is missing', async () => {
      mockUseChat.chatId = null;
      render(<FollowUpQuestions followUpQuestions={stubFollowUpQuestions} />);

      const firstQuestionButton = screen.getByText('What is the weather like today?');
      fireEvent.click(firstQuestionButton);

      expect(mockAddMessage.mutateAsync).not.toHaveBeenCalled();
    });
  });

  describe('Notifications', () => {
    it('shows warning notification when there are failed knowledge bases', async () => {
      mockAddMessage.mutateAsync.mockResolvedValue({
        failedKbs: ['kb3', 'kb4'],
      });

      render(<FollowUpQuestions followUpQuestions={stubFollowUpQuestions} />);

      const firstQuestionButton = screen.getByText('What is the weather like today?');
      fireEvent.click(firstQuestionButton);

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Some Knowledge Bases Could Not Be Accessed',
          message: 'The following knowledge bases could not be accessed: kb3, kb4',
          icon: <IconX />,
          autoClose: false,
          withCloseButton: true,
          variant: 'failed_operation',
        });
      });
    });

    it('shows error notification when addMessage fails', async () => {
      mockAddMessage.mutateAsync.mockRejectedValue(new Error('Test error'));

      render(<FollowUpQuestions followUpQuestions={stubFollowUpQuestions} />);

      const firstQuestionButton = screen.getByText('What is the weather like today?');
      fireEvent.click(firstQuestionButton);

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Failed to Add Message to Chat',
          message: 'An unexpected error occurred. Please try again later.',
          icon: <IconX />,
          autoClose: false,
          withCloseButton: true,
          variant: 'failed_operation',
        });
      });
    });

    it('clears pending message after failed submission', async () => {
      mockAddMessage.mutateAsync.mockRejectedValue(new Error('Test error'));

      render(<FollowUpQuestions followUpQuestions={stubFollowUpQuestions} />);

      const firstQuestionButton = screen.getByText('What is the weather like today?');
      fireEvent.click(firstQuestionButton);

      await waitFor(() => {
        expect(mockUseChat.setPendingMessage).toHaveBeenCalledWith(null);
      });
    });
  });
});
