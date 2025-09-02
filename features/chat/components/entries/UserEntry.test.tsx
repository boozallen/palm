import { List } from '@mantine/core';
import { render, screen } from '@testing-library/react';

import UserEntry from './UserEntry';
import { EntryType, MessageEntry } from '@/features/chat/types/entry';
import { MessageRole } from '@/features/chat/types/message';
import { useChat } from '@/features/chat/providers/ChatProvider';

jest.mock('@/features/chat/providers/ChatProvider', () => ({
  useChat: jest.fn(),
}));

jest.mock('./actions/UserEntryActions', () => ({
  UserEntryActions: jest.fn(() => <div>UserEntryActions</div>),
}));

jest.mock('./EditableUserEntry', () => ({
  EditableUserEntry: jest.fn(() => <div>EditableUserEntry</div>),
}));

const mockedUseChat = useChat as jest.Mock;

describe('UserEntry', () => {
  const mockEntry: MessageEntry = {
    id: 'c0266246-8f8a-4875-a382-19b3f77c265f',
    chatId: 'df036199-3654-4110-a999-521a1e73cd6d',
    type: EntryType.Message,
    createdAt: new Date(),
    role: MessageRole.User,
    content: '# This is a user message',
    citations: [],
  };

  const stubEntryBeingEdited = '0ebc6235-237e-41b9-8f91-c76a4210e119';

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseChat.mockReturnValue({
      entryBeingEdited: stubEntryBeingEdited,
    });
  });

  it('renders the content inside a pre tag with the correct class', () => {
    render(
      <List>
        <UserEntry entry={mockEntry} />
      </List>
    );
    const preElement = screen.getByText('# This is a user message');
    expect(preElement).toBeInTheDocument();
    expect(preElement.tagName).toBe('PRE');
    expect(preElement).toHaveClass('user-entry-content');
  });

  it('renders UserEntryActions', () => {
    render(
      <List>
        <UserEntry entry={mockEntry} />
      </List>
    );

    const userEntryActions = screen.getByText('UserEntryActions');

    expect(userEntryActions).toBeInTheDocument();
  });

  it('does not render editable component if entryBeingEdited is not equal to entryId', () => {
    render(
      <List>
        <UserEntry entry={mockEntry} />
      </List>
    );

    const editableEntry = screen.queryByText('EditableUserEntry');

    expect(editableEntry).not.toBeInTheDocument();
  });

  it('renders editable component if entryBeingEdited is equal to entryId', () => {
    mockedUseChat.mockReturnValueOnce({
      entryBeingEdited: mockEntry.id,
    });

    render(
      <List>
        <UserEntry entry={mockEntry} />
      </List>
    );

    const editableEntry = screen.getByText('EditableUserEntry');

    expect(editableEntry).toBeInTheDocument();
  });
});
