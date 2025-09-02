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
jest.mock('@/features/chat/providers/ChatProvider', () => ({
  useChat: jest.fn(),
}));

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
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capturedEntryProps = {};
    mockedUseChat.mockReturnValue({
      setSelectedText: mockSetSelectedText,
      setSelectedArtifact: mockSetSelectedArtifact,
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

  it('sets selected artifact if latest response and artifact available', () => {
    const newMockEntry = {
      ...mockEntry,
      artifacts: ['mock artifact'] as unknown as Artifact[],
    };

    render(
      <List>
        <AssistantEntry
          entry={newMockEntry}
          isLatestResponse={true}
          followUpReferencedInNextUserEntry={false}
        />
      </List>
    );

    expect(mockSetSelectedArtifact).toHaveBeenCalledTimes(1);
    expect(mockSetSelectedArtifact).toHaveBeenCalledWith(newMockEntry.artifacts[0]);
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
});
