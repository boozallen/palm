import { render, screen, fireEvent } from '@testing-library/react';
import UserEntry from './UserEntry';
import { EntryType, MessageEntry } from '@/features/chat/types/entry';
import { List } from '@mantine/core';
import { MessageRole } from '@/features/chat/types/message';

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

  const mockOnDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the content inside a pre tag with the correct class', () => {
    render(
      <List>
        <UserEntry entry={mockEntry} onDelete={mockOnDelete} />
      </List>
    );
    const preElement = screen.getByText('# This is a user message');
    expect(preElement).toBeInTheDocument();
    expect(preElement.tagName).toBe('PRE');
    expect(preElement).toHaveClass('user-entry-content');
  });

  it('renders the delete icon', () => {
    render(
      <List>
        <UserEntry entry={mockEntry} onDelete={mockOnDelete} />
      </List>);
    const deleteIcon = screen.getByTestId('icon-trash');
    expect(deleteIcon).toBeInTheDocument();
  });

  it('calls onDelete with the correct id when delete icon is clicked', () => {
    render(
      <List>
        <UserEntry entry={mockEntry} onDelete={mockOnDelete} />
      </List>);
    const deleteIcon = screen.getByTestId('icon-trash');

    fireEvent.click(deleteIcon);

    expect(mockOnDelete).toHaveBeenCalledWith(mockEntry.id);
  });
});
