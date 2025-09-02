import { render, screen } from '@testing-library/react';

import { EditableUserEntry } from './EditableUserEntry';
import { EntryType, MessageEntry } from '@/features/chat/types/entry';
import { MessageRole } from '@/features/chat/types/message';

jest.mock('@/features/chat/components/forms/EditUserEntryForm', () => ({
  EditUserEntryForm: jest.fn(() => <div>EditUserEntryForm</div>),
}));

jest.mock('./Entry', () => {
  return jest.fn(({ children }) => <div data-testid='entry-component'>{children}</div>);
});

describe('EditableUserEntry', () => {

  const stubEntry: MessageEntry = {
    id: 'test-entry-id',
    chatId: 'test-chat-id',
    type: EntryType.Message,
    role: MessageRole.User,
    content: 'This is a test entry',
    createdAt: new Date(),
  };

  beforeEach(jest.clearAllMocks);

  it('renders Entry component', () => {
    render(<EditableUserEntry entry={stubEntry}/>);

    const entryComponent = screen.getByTestId('entry-component');

    expect(entryComponent).toBeInTheDocument();
  });

  it('renders EditUserEntryForm component', () => {
    render(<EditableUserEntry entry={stubEntry}/>);

    const formComponent = screen.getByText('EditUserEntryForm');

    expect(formComponent).toBeInTheDocument();
  });
});
