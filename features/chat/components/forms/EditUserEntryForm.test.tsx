import { notifications } from '@mantine/notifications';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { EditUserEntryForm } from './EditUserEntryForm';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { EntryType, MessageEntry } from '@/features/chat/types/entry';
import { MessageRole } from '@/features/chat/types/message';
import useEditMessage from '@/features/chat/hooks/useEditMessage';

jest.mock('@mantine/notifications');
jest.mock('@/features/chat/hooks/useEditMessage');
jest.mock('@/features/chat/providers/ChatProvider', () => ({
  useChat: jest.fn(),
}));

const mockedUseChat = useChat as jest.Mock;
const mockedUseEditMessage = useEditMessage as jest.Mock;

describe('EditUserEntryForm', () => {
  const mockSetEntryBeingEdited = jest.fn();
  const mockSetRegeneratingResponse = jest.fn();
  const mockMutateAsync = jest.fn();

  const mockEntry: MessageEntry = {
    id: 'c0266246-8f8a-4875-a382-19b3f77c265f',
    chatId: 'df036199-3654-4110-a999-521a1e73cd6d',
    type: EntryType.Message,
    createdAt: new Date(),
    role: MessageRole.User,
    content: 'This is a test message content',
    citations: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseChat.mockReturnValue({
      setEntryBeingEdited: mockSetEntryBeingEdited,
      setRegeneratingResponse: mockSetRegeneratingResponse,
    });

    mockedUseEditMessage.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
  });

  it('renders the form with textarea containing entry content', () => {
    render(<EditUserEntryForm entry={mockEntry} />);

    const textarea = screen.getByRole('textbox');

    expect(textarea).toBeInTheDocument();
  });

  it('initializes textarea value to original entry content', () => {
    render(<EditUserEntryForm entry={mockEntry} />);

    const textarea = screen.getByLabelText('Write your updated message here');

    expect(textarea).toHaveValue('This is a test message content');
  });

  it('updates textarea value when user types', () => {
    render(<EditUserEntryForm entry={mockEntry} />);

    const textarea = screen.getByRole('textbox');
    const newContent = 'Updated message content';

    fireEvent.change(textarea, { target: { value: newContent } });

    expect(textarea).toHaveValue(newContent);
  });

  it('calls setEntryBeingEdited with null when cancel button is clicked', () => {
    render(<EditUserEntryForm entry={mockEntry} />);

    const cancelButton = screen.getByLabelText('Cancel editing message');
    fireEvent.click(cancelButton);

    expect(mockSetEntryBeingEdited).toHaveBeenCalledWith(null);
  });

  it('calls sets regenerating response to true when submit button is clicked', () => {
    render(<EditUserEntryForm entry={mockEntry} />);

    // submit response
    const submitButton = screen.getByLabelText('Save edited message');
    fireEvent.click(submitButton);

    expect(mockSetRegeneratingResponse).toHaveBeenCalledWith(true);
  });

  it('calls mutateAsync with updated message when submit button is clicked', () => {
    render(<EditUserEntryForm entry={mockEntry} />);

    // Update user's message
    const textarea = screen.getByRole('textbox');
    const newContent = 'Updated message content';
    fireEvent.change(textarea, { target: { value: newContent } });

    // submit response
    const submitButton = screen.getByLabelText('Save edited message');
    fireEvent.click(submitButton);

    expect(mockMutateAsync).toHaveBeenCalledWith(newContent);
  });

  it('displays notification error if update fails', () => {
    mockMutateAsync.mockRejectedValue(new Error('This is a test error'));

    render(<EditUserEntryForm entry={mockEntry} />);

    // Update user's message
    const textarea = screen.getByRole('textbox');
    const newContent = 'Updated message content';
    fireEvent.change(textarea, { target: { value: newContent } });

    // submit response
    const submitButton = screen.getByLabelText('Save edited message');
    fireEvent.click(submitButton);

    waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'This is a test error',
        })
      );
    });
  });
});
