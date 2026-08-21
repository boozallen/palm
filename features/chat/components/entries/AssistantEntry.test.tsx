import { render, screen } from '@testing-library/react';
import { List } from '@mantine/core';

import AssistantEntry from './AssistantEntry';
import { EntryType, MessageEntry } from '@/features/chat/types/entry';
import { Artifact, MessageRole } from '@/features/chat/types/message';
import Entry from './Entry';
import AssistantEntryActions from '@/features/chat/components/entries/actions/AssistantEntryActions';
import { useChat } from '@/features/chat/providers/ChatProvider';

type CapturedEntryProps = {
  id?: string;
  avatar?: React.ReactElement;
  role?: MessageRole;
  actions?: React.ReactElement;
  citations?: any[];
  artifacts?: any[];
  children?: React.ReactNode;
  [key: string]: any;
};

let capturedEntryProps: CapturedEntryProps = {};

jest.mock('@/features/chat/components/entries/Entry', () => {
  const mockEntry = jest.fn((props: CapturedEntryProps) => {
    capturedEntryProps = { ...props };
    return <div>{props.children}</div>;
  });
  return mockEntry;
});

jest.mock('@/features/chat/components/entries/actions/AssistantEntryActions', () => {
  return jest.fn().mockReturnValue(<div data-testid='AssistantEntryActions' />);
});
jest.mock('@/features/chat/components/entries/elements/FollowUpQuestions', () => {
  return jest.fn(() => <div>Follow Up Questions</div>);
});

// Capture the graph-citation handlers AssistantEntry builds so we can drive onPin like a citation anchor.
let capturedGraphCitations: { onPin: (t: any) => void } | undefined;
jest.mock('@/features/chat/components/MessageContent', () => ({
  __esModule: true,
  default: jest.fn((props: any) => {
    capturedGraphCitations = props.graphCitations;
    return <div>{props.content}</div>;
  }),
}));
jest.mock('@/features/chat/providers/ChatProvider', () => ({
  useChat: jest.fn(),
}));

jest.mock('@/features/chat/api/get-chat-job-status', () => ({
  useGetChatJobStatus: jest.fn(() => ({ data: null })),
}));

jest.mock('@/libs', () => ({
  trpc: {
    useUtils: jest.fn(() => ({
      client: {
        chat: {
          getDeepResearchStatus: {
            query: jest.fn(),
          },
        },
      },
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
      getDeepResearchStatus: {
        useQuery: jest.fn().mockReturnValue({
          data: undefined,
          isLoading: false,
          error: null,
        }),
      },
    },
  },
}));

jest.mock('@/features/chat/components/DeepResearchLoading', () => {
  return jest.fn(() => <div>Deep Research Loading</div>);
});

const mockedUseChat = useChat as jest.Mock;

describe('AssistantEntry', () => {
  const mockSetSelectedText = jest.fn();
  const mockSetSelectedArtifact = jest.fn();

  const mockEntry: MessageEntry = {
    id: 'e840b4d6-ccf6-4e84-b475-7ffe1fcebf78',
    chatId: '952b2a39-e70b-471d-aa54-e2e2c7ce9168',
    type: EntryType.Message,
    createdAt: new Date(),
    role: MessageRole.Assistant,
    content: 'This is a test message',
    citations: [],
    artifacts: [],
    followUps: [],
    deepResearch: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capturedEntryProps = {};
    capturedGraphCitations = undefined;
    mockedUseChat.mockReturnValue({
      setSelectedText: mockSetSelectedText,
      setSelectedArtifact: mockSetSelectedArtifact,
      chatId: '952b2a39-e70b-471d-aa54-e2e2c7ce9168',
      hasUserSubmittedMessageInSession: false,
      useGraph: false,
      setGraphCitationInspect: jest.fn(),
      requestGraphCitationPin: jest.fn(),
    });
  });

  it('renders the Markdown content', () => {
    render(
      <List>
        <AssistantEntry
          entry={mockEntry}
          isLatestResponse={false}
          followUpReferencedInNextUserEntry={false}
        />
      </List>
    );
    expect(screen.getByText('This is a test message')).toBeInTheDocument();
  });

  it('calls Entry component without an avatar', () => {
    render(
      <List>
        <AssistantEntry
          entry={mockEntry}
          isLatestResponse={false}
          followUpReferencedInNextUserEntry={false}
        />
      </List>
    );

    expect(Entry).toHaveBeenCalled();

    expect(capturedEntryProps.avatar).toBeNull();
  });

  it('calls Entry component with AssistantEntryActions', () => {
    render(
      <List>
        <AssistantEntry
          entry={mockEntry}
          isLatestResponse={false}
          followUpReferencedInNextUserEntry={false}
        />
      </List>
    );

    expect(Entry).toHaveBeenCalled();

    expect(capturedEntryProps.actions).toBeTruthy();
    if (capturedEntryProps.actions) {
      expect(capturedEntryProps.actions.type).toBe(AssistantEntryActions);
    }
  });

  it('renders artifacts when available', () => {
    const mockArtifact: Artifact = {
      id: 'artifact-1',
      chatMessageId: mockEntry.id,
      fileExtension: '.md',
      label: 'test-artifact',
      content: 'mock artifact content',
      githubPagesUrl: null,
      createdAt: new Date(),
    };

    const newMockEntry = {
      ...mockEntry,
      artifacts: [mockArtifact],
    };

    mockedUseChat.mockReturnValue({
      setSelectedText: mockSetSelectedText,
      setSelectedArtifact: mockSetSelectedArtifact,
      chatId: '952b2a39-e70b-471d-aa54-e2e2c7ce9168',
      hasUserSubmittedMessageInSession: true,
      useGraph: false,
      setGraphCitationInspect: jest.fn(),
      requestGraphCitationPin: jest.fn(),
    });

    render(
      <List>
        <AssistantEntry
          entry={newMockEntry}
          isLatestResponse={true}
          followUpReferencedInNextUserEntry={false}
        />
      </List>
    );

    expect(mockSetSelectedArtifact).not.toHaveBeenCalled();
  });

  it('renders follow up questions component when isLatestResponse is true', () => {
    render(
      <List>
        <AssistantEntry
          entry={mockEntry}
          isLatestResponse={true}
          followUpReferencedInNextUserEntry={false}
        />
      </List>
    );

    const component = screen.getByText('Follow Up Questions');

    expect(component).toBeInTheDocument();
  });

    it('renders follow up questions component when followUpReferencedInNextUserEntry is true', () => {
    render(
      <List>
        <AssistantEntry
          entry={mockEntry}
          isLatestResponse={false}
          followUpReferencedInNextUserEntry={true}
        />
      </List>
    );

    const component = screen.getByText('Follow Up Questions');

    expect(component).toBeInTheDocument();
  });

  it('forwards the cited target AND this answer message id to the graph pin remote', () => {
    const requestGraphCitationPin = jest.fn();
    mockedUseChat.mockReturnValue({
      setSelectedText: mockSetSelectedText,
      setSelectedArtifact: mockSetSelectedArtifact,
      chatId: '952b2a39-e70b-471d-aa54-e2e2c7ce9168',
      useGraph: true,
      requestGraphCitationPin,
    });

    const entryWithCitation = {
      ...mockEntry,
      graphCitation: { citedText: 'cited answer', handleMap: { E1: 'uuid-1' } },
    } as MessageEntry;

    render(
      <List>
        <AssistantEntry entry={entryWithCitation} isLatestResponse={false} />
      </List>
    );

    // Drive the pin exactly as a clicked citation anchor would.
    capturedGraphCitations?.onPin({ nodeUuid: 'uuid-1' });

    expect(requestGraphCitationPin).toHaveBeenCalledWith({ nodeUuid: 'uuid-1' }, entryWithCitation.id);
  });
});
