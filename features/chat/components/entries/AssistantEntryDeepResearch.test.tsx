import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { List } from '@mantine/core';

import AssistantEntryDeepResearch from './AssistantEntryDeepResearch';
import { EntryType, MessageEntry } from '@/features/chat/types/entry';
import { MessageRole, DeepResearchStatus, Artifact, ChatMessageFollowUp, ContextType } from '@/features/chat/types/message';
import Entry from './Entry';
import AssistantEntryActions from '@/features/chat/components/entries/actions/AssistantEntryActions';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { useGetDeepResearchStatus } from '@/features/chat/api/get-deep-research-status';

type CapturedEntryProps = {
  id?: string;
  avatar?: React.ReactElement | null;
  role?: MessageRole;
  actions?: React.ReactElement;
  citations?: any[];
  artifacts?: any[];
  children?: React.ReactNode;
  deepResearch?: boolean;
  [key: string]: any;
};

let capturedEntryProps: CapturedEntryProps = {};

jest.mock('@/features/chat/components/entries/Entry', () => {
  const mockEntry = jest.fn((props: CapturedEntryProps) => {
    capturedEntryProps = { ...props };
    return <div data-testid='entry'>{props.children}</div>;
  });
  return mockEntry;
});

jest.mock('@/features/chat/components/entries/actions/AssistantEntryActions', () => {
  return jest.fn(() => <div data-testid='AssistantEntryActions' />);
});

jest.mock('@/features/chat/components/entries/elements/FollowUpQuestions', () => {
  return jest.fn(({ followUpQuestions }: { followUpQuestions?: ChatMessageFollowUp[] }) => (
    <div data-testid='FollowUpQuestions'>
      {followUpQuestions?.length ? `${followUpQuestions.length} follow-up questions` : 'No follow-up questions'}
    </div>
  ));
});

jest.mock('@/features/chat/components/entries/actions/SelectedTextPopup', () => {
  return jest.fn(() => <div data-testid='SelectedTextPopup' />);
});

jest.mock('@/features/chat/components/DeepResearchLoading', () => {
  return jest.fn(() => <div data-testid='DeepResearchLoading'>Deep Research Loading</div>);
});

jest.mock('@/components/content/Markdown', () => {
  return jest.fn(({ value }: { value?: string }) => (
    <div data-testid='Markdown'>{value || 'No content'}</div>
  ));
});

jest.mock('@/features/chat/providers/ChatProvider', () => ({
  useChat: jest.fn(),
}));

jest.mock('@/features/chat/api/get-deep-research-status', () => ({
  useGetDeepResearchStatus: jest.fn(),
}));

jest.mock('@/libs', () => ({
  trpc: {
    useUtils: jest.fn(() => ({
      chat: {
        getMessages: {
          invalidate: jest.fn(),
        },
      },
    })),
    useContext: jest.fn(() => ({
      chat: {
        getMessages: {
          setData: jest.fn(),
        },
        getChats: {
          invalidate: jest.fn(),
        },
      },
    })),
    chat: {
      addMessage: {
        useMutation: jest.fn(() => ({
          mutateAsync: jest.fn(),
          isPending: false,
        })),
      },
    },
  },
}));

const mockedUseChat = useChat as jest.Mock;
const mockedUseGetDeepResearchStatus = useGetDeepResearchStatus as jest.Mock;

describe('AssistantEntryDeepResearch', () => {
  const mockSetSelectedArtifact = jest.fn();
  const mockChatId = 'test-chat-id';
  const mockInvalidate = jest.fn();

  const baseEntry: MessageEntry = {
    id: 'test-entry-id',
    chatId: mockChatId,
    type: EntryType.Message,
    createdAt: new Date(),
    role: MessageRole.Assistant,
    content: 'This is deep research content',
    citations: [
      {
        contextType: ContextType.KNOWLEDGE_BASE,
        knowledgeBaseId: 'kb1',
        sourceLabel: 'Test Source',
        citation: 'Test citation',
      },
    ],
    artifacts: [],
    followUps: [
      {
        id: 'followup-1',
        chatMessageId: 'test-entry-id',
        content: 'What is the next step?',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    deepResearch: true,
    deepResearchJobId: 'job-123',
    deepResearchStatus: DeepResearchStatus.COMPLETED,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capturedEntryProps = {};

    mockedUseChat.mockReturnValue({
      setSelectedArtifact: mockSetSelectedArtifact,
      chatId: mockChatId,
    });

    mockedUseGetDeepResearchStatus.mockReturnValue({
      data: undefined,
    });

    // Mock trpc utils
    require('@/libs').trpc.useUtils.mockReturnValue({
      chat: {
        getMessages: {
          invalidate: mockInvalidate,
        },
      },
    });
  });

  describe('Rendering completed deep research', () => {
    it('renders markdown content when deep research is completed', () => {
      render(
        <List>
          <AssistantEntryDeepResearch
            entry={baseEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      expect(screen.getByTestId('Markdown')).toBeInTheDocument();
      expect(screen.getByText('This is deep research content')).toBeInTheDocument();
      expect(screen.queryByTestId('DeepResearchLoading')).not.toBeInTheDocument();
    });

    it('calls Entry component with correct props for completed research', () => {
      render(
        <List>
          <AssistantEntryDeepResearch
            entry={baseEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      expect(Entry).toHaveBeenCalled();
      expect(capturedEntryProps.id).toBe('test-entry-id');
      expect(capturedEntryProps.avatar).toBeNull();
      expect(capturedEntryProps.role).toBe(MessageRole.Assistant);
      expect(capturedEntryProps.deepResearch).toBe(true);
      expect(capturedEntryProps.citations).toBe(baseEntry.citations);
      expect(capturedEntryProps.artifacts).toBe(baseEntry.artifacts);
    });

    it('passes AssistantEntryActions to Entry component', () => {
      render(
        <List>
          <AssistantEntryDeepResearch
            entry={baseEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      // Check that the actions prop was passed to Entry
      expect(capturedEntryProps.actions).toBeDefined();
      expect(React.isValidElement(capturedEntryProps.actions)).toBe(true);
      
      // Verify the actions prop contains AssistantEntryActions with correct props
      const actionsElement = capturedEntryProps.actions as React.ReactElement;
      expect(actionsElement.type).toBe(AssistantEntryActions);
      expect(actionsElement.props).toEqual({
        messageId: 'test-entry-id',
        messageContent: 'This is deep research content',
      });
    });

    it('hides AssistantEntryActions when deep research is processing', () => {
      const pendingEntry = {
        ...baseEntry,
        deepResearchStatus: DeepResearchStatus.PENDING,
      };

      render(
        <List>
          <AssistantEntryDeepResearch
            entry={pendingEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      expect(capturedEntryProps.actions).toBeNull();
    });
  });

  describe('Rendering loading states', () => {
    it('renders loading skeleton when status is PENDING', () => {
      const pendingEntry = {
        ...baseEntry,
        deepResearchStatus: DeepResearchStatus.PENDING,
      };

      render(
        <List>
          <AssistantEntryDeepResearch
            entry={pendingEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      expect(screen.getByTestId('DeepResearchLoading')).toBeInTheDocument();
      expect(screen.queryByTestId('Markdown')).not.toBeInTheDocument();
    });

    it('renders loading skeleton when status is PENDING', () => {
      const pendingEntry = {
        ...baseEntry,
        deepResearchStatus: DeepResearchStatus.PENDING,
      };

      render(
        <List>
          <AssistantEntryDeepResearch
            entry={pendingEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      expect(screen.getByTestId('DeepResearchLoading')).toBeInTheDocument();
      expect(screen.queryByTestId('Markdown')).not.toBeInTheDocument();
    });

    it('renders loading skeleton when status is undefined (backward compatibility)', () => {
      const undefinedStatusEntry = {
        ...baseEntry,
        deepResearchStatus: undefined,
      };

      render(
        <List>
          <AssistantEntryDeepResearch
            entry={undefinedStatusEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      expect(screen.getByTestId('DeepResearchLoading')).toBeInTheDocument();
      expect(screen.queryByTestId('Markdown')).not.toBeInTheDocument();
    });

    it('renders loading skeleton when status is null (backward compatibility)', () => {
      const nullStatusEntry = {
        ...baseEntry,
        deepResearchStatus: null,
      };

      render(
        <List>
          <AssistantEntryDeepResearch
            entry={nullStatusEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      expect(screen.getByTestId('DeepResearchLoading')).toBeInTheDocument();
      expect(screen.queryByTestId('Markdown')).not.toBeInTheDocument();
    });
  });

  describe('Status polling behavior', () => {
    it('calls useGetDeepResearchStatus with correct params when research is still processing', () => {
      const pendingEntry = {
        ...baseEntry,
        deepResearchStatus: DeepResearchStatus.PENDING,
      };

      render(
        <List>
          <AssistantEntryDeepResearch
            entry={pendingEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      expect(mockedUseGetDeepResearchStatus).toHaveBeenCalledWith(
        'job-123',
        mockChatId,
        'test-entry-id'
      );
    });

    it('does not poll when research is completed', () => {
      render(
        <List>
          <AssistantEntryDeepResearch
            entry={baseEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      expect(mockedUseGetDeepResearchStatus).toHaveBeenCalledWith(
        undefined,
        mockChatId,
        'test-entry-id'
      );
    });

    it('uses polled status over entry status when available', () => {
      const pendingEntry = {
        ...baseEntry,
        deepResearchStatus: DeepResearchStatus.PENDING,
      };

      mockedUseGetDeepResearchStatus.mockReturnValue({
        data: { status: DeepResearchStatus.COMPLETED },
      });

      render(
        <List>
          <AssistantEntryDeepResearch
            entry={pendingEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      // Should show content since polled status is COMPLETED
      expect(screen.getByTestId('Markdown')).toBeInTheDocument();
      expect(screen.queryByTestId('DeepResearchLoading')).not.toBeInTheDocument();
    });

    it('invalidates messages when deep research completes via polling', async () => {
      const pendingEntry = {
        ...baseEntry,
        deepResearchStatus: DeepResearchStatus.PENDING,
      };

      // Start with pending status
      const { rerender } = render(
        <List>
          <AssistantEntryDeepResearch
            entry={pendingEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      // Simulate polling completing
      mockedUseGetDeepResearchStatus.mockReturnValue({
        data: { status: DeepResearchStatus.COMPLETED },
      });

      rerender(
        <List>
          <AssistantEntryDeepResearch
            entry={pendingEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      await waitFor(() => {
        expect(mockInvalidate).toHaveBeenCalledWith({ chatId: mockChatId });
      });
    });
  });

  describe('Artifact rendering', () => {
    it('renders artifacts when available', () => {
      const mockArtifact: Artifact = {
        id: 'artifact-1',
        chatMessageId: baseEntry.id,
        fileExtension: '.md',
        label: 'test-artifact',
        content: 'mock artifact content',
        githubPagesUrl: null,
        createdAt: new Date(),
      };

      const artifactEntry = {
        ...baseEntry,
        artifacts: [mockArtifact],
      };

      render(
        <List>
          <AssistantEntryDeepResearch
            entry={artifactEntry}
            isLatestResponse={true}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      expect(mockSetSelectedArtifact).not.toHaveBeenCalled();
    });
  });

  describe('Follow-up questions', () => {
    it('displays follow-up questions when isLatestResponse is true', () => {
      render(
        <List>
          <AssistantEntryDeepResearch
            entry={baseEntry}
            isLatestResponse={true}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      expect(screen.getByText('1 follow-up questions')).toBeInTheDocument();
    });

    it('displays follow-up questions when followUpReferencedInNextUserEntry is true', () => {
      render(
        <List>
          <AssistantEntryDeepResearch
            entry={baseEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={true}
          />
        </List>
      );

      expect(screen.getByText('1 follow-up questions')).toBeInTheDocument();
    });

    it('does not display follow-up questions when neither condition is met', () => {
      render(
        <List>
          <AssistantEntryDeepResearch
            entry={baseEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      expect(screen.getByText('No follow-up questions')).toBeInTheDocument();
    });

    it('handles empty follow-up questions array', () => {
      const entryWithoutFollowUps = {
        ...baseEntry,
        followUps: [],
      };

      render(
        <List>
          <AssistantEntryDeepResearch
            entry={entryWithoutFollowUps}
            isLatestResponse={true}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      expect(screen.getByText('No follow-up questions')).toBeInTheDocument();
    });
  });

  describe('Edge cases and error handling', () => {
    it('handles missing chatId gracefully', () => {
      mockedUseChat.mockReturnValue({
        setSelectedArtifact: mockSetSelectedArtifact,
        chatId: null,
      });

      render(
        <List>
          <AssistantEntryDeepResearch
            entry={baseEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      // Should still render without crashing
      expect(screen.getByTestId('Markdown')).toBeInTheDocument();
    });

    it('handles missing deepResearchJobId', () => {
      const entryWithoutJobId = {
        ...baseEntry,
        deepResearchJobId: undefined,
      };

      render(
        <List>
          <AssistantEntryDeepResearch
            entry={entryWithoutJobId}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      expect(mockedUseGetDeepResearchStatus).toHaveBeenCalledWith(
        undefined,
        mockChatId,
        'test-entry-id'
      );
    });

    it('handles FAILED status as completed research', () => {
      const failedEntry = {
        ...baseEntry,
        deepResearchStatus: DeepResearchStatus.FAILED,
      };

      render(
        <List>
          <AssistantEntryDeepResearch
            entry={failedEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      // Failed research should show content, not loading
      expect(screen.getByTestId('Markdown')).toBeInTheDocument();
      expect(screen.queryByTestId('DeepResearchLoading')).not.toBeInTheDocument();
    });

    it('renders SelectedTextPopup component', () => {
      render(
        <List>
          <AssistantEntryDeepResearch
            entry={baseEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      expect(screen.getByTestId('SelectedTextPopup')).toBeInTheDocument();
    });
  });

  describe('Status transitions', () => {
    it('transitions from loading to content when status changes from PENDING to COMPLETED', () => {
      const pendingEntry = {
        ...baseEntry,
        deepResearchStatus: DeepResearchStatus.PENDING,
      };

      const { rerender } = render(
        <List>
          <AssistantEntryDeepResearch
            entry={pendingEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      // Initially shows loading
      expect(screen.getByTestId('DeepResearchLoading')).toBeInTheDocument();

      // Update to completed status
      const completedEntry = {
        ...baseEntry,
        deepResearchStatus: DeepResearchStatus.COMPLETED,
      };

      rerender(
        <List>
          <AssistantEntryDeepResearch
            entry={completedEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      // Now shows content
      expect(screen.getByTestId('Markdown')).toBeInTheDocument();
      expect(screen.queryByTestId('DeepResearchLoading')).not.toBeInTheDocument();
    });

    it('transitions from loading to content when status changes from PENDING to COMPLETED', () => {
      const pendingEntry = {
        ...baseEntry,
        deepResearchStatus: DeepResearchStatus.PENDING,
      };

      const { rerender } = render(
        <List>
          <AssistantEntryDeepResearch
            entry={pendingEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      // Initially shows loading
      expect(screen.getByTestId('DeepResearchLoading')).toBeInTheDocument();

      // Update to completed status
      const completedEntry = {
        ...baseEntry,
        deepResearchStatus: DeepResearchStatus.COMPLETED,
      };

      rerender(
        <List>
          <AssistantEntryDeepResearch
            entry={completedEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      // Now shows content
      expect(screen.getByTestId('Markdown')).toBeInTheDocument();
      expect(screen.queryByTestId('DeepResearchLoading')).not.toBeInTheDocument();
    });
  });

  describe('Cancelled state', () => {
    it('renders cancelled message when deep research is cancelled', () => {
      const cancelledEntry = {
        ...baseEntry,
        deepResearchStatus: DeepResearchStatus.CANCELLED,
      };

      render(
        <List>
          <AssistantEntryDeepResearch
            entry={cancelledEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      expect(screen.getByText('Research cancelled')).toBeInTheDocument();
      expect(screen.getByTestId('Markdown')).toBeInTheDocument();
      expect(screen.queryByTestId('DeepResearchLoading')).not.toBeInTheDocument();
    });

    it('transitions from loading to cancelled message when status changes', () => {
      const pendingEntry = {
        ...baseEntry,
        deepResearchStatus: DeepResearchStatus.PENDING,
      };

      const { rerender } = render(
        <List>
          <AssistantEntryDeepResearch
            entry={pendingEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      // Initially shows loading
      expect(screen.getByTestId('DeepResearchLoading')).toBeInTheDocument();

      // Update to cancelled status
      const cancelledEntry = {
        ...baseEntry,
        deepResearchStatus: DeepResearchStatus.CANCELLED,
      };

      rerender(
        <List>
          <AssistantEntryDeepResearch
            entry={cancelledEntry}
            isLatestResponse={false}
            followUpReferencedInNextUserEntry={false}
          />
        </List>
      );

      // Now shows cancelled message
      expect(screen.getByText('Research cancelled')).toBeInTheDocument();
      expect(screen.queryByTestId('DeepResearchLoading')).not.toBeInTheDocument();
    });
  });
});
