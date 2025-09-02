import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { List } from '@mantine/core';
import { notifications } from '@mantine/notifications';

import SystemEntry from './SystemEntry';
import { useChat } from '@/features/chat/providers/ChatProvider';
import useGetOriginPrompt from '@/features/chat/api/get-origin-prompt';
import useUpdateMessage from '@/features/chat/api/update-message';
import { EntryType, MessageEntry } from '@/features/chat/types/entry';
import { MessageRole } from '@/features/chat/types/message';

jest.mock('@/features/chat/providers/ChatProvider', () => ({
  useChat: jest.fn(),
}));

jest.mock('@/features/chat/api/get-origin-prompt', () => jest.fn());

jest.mock('@/features/chat/api/update-message', () => jest.fn());

jest.mock('@mantine/notifications', () => ({
  notifications: {
    show: jest.fn(),
  },
}));

describe('SystemEntry', () => {
  const mockContent = 'Initial system message';
  const mockEditedContent = 'Edited system message';

  const mockEntry: MessageEntry = {
    id: 'b2d38abe-3c19-4c00-ba51-3f574f695303',
    chatId: 'f82ffed9-5d62-4e84-b298-d37b6fb241ef',
    type: EntryType.Message,
    createdAt: new Date(),
    role: MessageRole.System,
    content: mockContent,
    citations: [],
  };

  const mockPromptId = '833c46bc-039b-4156-a857-dc846c6cf64d';

  const setSystemMessageMock = jest.fn();
  const updateMessageMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useChat as jest.Mock).mockReturnValue({
      chatId: null,
      promptId: mockPromptId,
      setSystemMessage: setSystemMessageMock,
    });

    (useGetOriginPrompt as jest.Mock).mockReturnValue({
      data: null,
    });

    (useUpdateMessage as jest.Mock).mockReturnValue({
      mutateAsync: updateMessageMock,
    });
  });

  it('renders the system entry with initial content', () => {
    render(
      <List>
        <SystemEntry entry={mockEntry} />
      </List>);
    expect(screen.getByText(mockContent)).toBeInTheDocument();
  });

  it('allows editing when chat has not started', () => {
    render(
    <List>
      <SystemEntry entry={mockEntry} />
    </List>);
    const editButton = screen.getByRole('button', { name: 'Edit' });
    expect(editButton).toBeInTheDocument();
  });

  it('updates the system message text area with user input', () => {
    render(
      <List>
        <SystemEntry entry={mockEntry} />
      </List>);
    const editButton = screen.getByRole('button', { name: 'Edit' });
    fireEvent.click(editButton);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    fireEvent.change(textarea, { target: { value: mockEditedContent } });

    expect(screen.getByText(mockEditedContent)).toBeInTheDocument();
  });

  it('updates the system message upon clicking save', async () => {
    render(
      <List>
        <SystemEntry entry={mockEntry} />
      </List>);
    const editButton = screen.getByRole('button', { name: 'Edit' });
    fireEvent.click(editButton);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    fireEvent.change(textarea, { target: { value: mockEditedContent } });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(setSystemMessageMock).toHaveBeenCalledWith(mockEditedContent);
    });
    expect(screen.getByText(mockEditedContent)).toBeInTheDocument();
  });

  it('allows submission of form via keyboard', async () => {
    render(
        <List>
          <SystemEntry entry={mockEntry} />
        </List>);
    const editButton = screen.getByRole('button', { name: 'Edit' });
    fireEvent.click(editButton);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    fireEvent.change(textarea, { target: { value: mockEditedContent } });

    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(setSystemMessageMock).toHaveBeenCalledWith(mockEditedContent);
    });
  });

  it('allows editing even when chat has started', () => {
    (useChat as jest.Mock).mockReturnValue({
      chatId: 'd54a2f34-e41d-4f8e-86bb-70d947f2b36e',
      promptId: mockPromptId,
      setSystemMessage: setSystemMessageMock,
    });

    render(
      <List>
        <SystemEntry entry={mockEntry} />
      </List>);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('cancels editing and restores last saved content', () => {
    render(
      <List>
        <SystemEntry entry={mockEntry} />
      </List>);
    const editButton = screen.getByRole('button', { name: 'Edit' });
    fireEvent.click(editButton);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: mockEditedContent } });

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(screen.getByText(mockContent)).toBeInTheDocument();
  });

  it('displays the origin prompt info if available', () => {
    const mockPromptTitle = 'Test Prompt Title';
    const mockPromptInstructions = 'Prompt instructions';

    (useGetOriginPrompt as jest.Mock).mockReturnValue({
      data: {
        prompt: {
          title: mockPromptTitle,
          id: mockPromptId,
          instructions: mockPromptInstructions,
        },
      },
    });

    render(
      <List>
        <SystemEntry entry={mockEntry} />
      </List>);
    expect(screen.getByText(mockPromptTitle)).toBeInTheDocument();
    expect(screen.getByText(mockPromptInstructions)).toBeInTheDocument();
  });

  it('shows notification when update message fails', async () => {
    updateMessageMock.mockRejectedValueOnce(new Error('Update failed'));

    render(
      <List>
        <SystemEntry entry={mockEntry} />
      </List>);
    
    const editButton = screen.getByRole('button', { name: 'Edit' });
    fireEvent.click(editButton);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: mockEditedContent } });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Failed to Update System Message',
        message: 'An unexpected error occurred. Please try again later.',
        icon: expect.any(Object),
        autoClose: true,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    });
  });
});
