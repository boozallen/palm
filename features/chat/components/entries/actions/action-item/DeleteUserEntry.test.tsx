import { act, fireEvent, render, screen } from '@testing-library/react';

import { DeleteUserEntry } from './DeleteUserEntry';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { useRemoveMessageModal } from '@/features/chat/modals/useRemoveMessageModal';

jest.mock('@/features/chat/modals/useRemoveMessageModal', () => ({
  useRemoveMessageModal: jest.fn(),
}));

jest.mock('@/features/chat/providers/ChatProvider', () => ({
  useChat: jest.fn(),
}));

const mockUseChat = useChat as jest.Mock;
const mockUseRemoveMessageModal = useRemoveMessageModal as jest.Mock;

describe('DeleteUserEntry', () => {
  const stubEntryId = 'ddbf16b7-4f00-40fc-afa8-f585e9895e1e';
  const stubChatId = '35329651-af5f-4966-97bd-200e0e4414c7';
  const mockRemoveMessage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseChat.mockReturnValueOnce({
      chatId: stubChatId,
    });

    mockUseRemoveMessageModal.mockReturnValueOnce({
      removeMessage: mockRemoveMessage,
    });
  });

  it('renders action icon', () => {
    render(<DeleteUserEntry entryId={stubEntryId} />);

    const actionIcon = screen.getByLabelText(/delete message/i);

    expect(actionIcon).toBeInTheDocument();
  });

  it('calls modal with chatId', () => {
    render(<DeleteUserEntry entryId={stubEntryId} />);

    expect(mockUseRemoveMessageModal).toHaveBeenCalledWith(stubChatId);
  });

  it('calls remove message with entryId when action icon is clicked', () => {
    render(<DeleteUserEntry entryId={stubEntryId} />);

    const actionIcon = screen.getByLabelText(/delete message/i);
    act(() => fireEvent.click(actionIcon));

    expect(mockRemoveMessage).toHaveBeenCalledWith(stubEntryId);
  });
});
