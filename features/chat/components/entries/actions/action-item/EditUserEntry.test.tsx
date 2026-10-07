import { act, fireEvent, render, screen } from '@testing-library/react';

import { EditUserEntry } from './EditUserEntry';
import { useChat } from '@/features/chat/providers/ChatProvider';

jest.mock('@/features/chat/providers/ChatProvider', () =>({
  useChat: jest.fn(),
}));

const mockUseChat = useChat as jest.Mock;

describe('EditUserEntry', () => {
  const stubEntryId = 'd847379e-e1ce-4674-866e-6eb5638c1eed';
  const mockSetEntryBeingEdited = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseChat.mockReturnValueOnce({
      setEntryBeingEdited: mockSetEntryBeingEdited,
    });
  });

  it('renders actionIcon', () => {
    render(<EditUserEntry entryId={stubEntryId} />);

    const actionIcon = screen.getByLabelText(/edit your message/i);

    expect(actionIcon).toBeInTheDocument();
  });

  it('sets editing entry when action icon is clicked', () => {
    render(<EditUserEntry entryId={stubEntryId} />);

    const actionIcon = screen.getByLabelText(/edit your message/i);
    act(() => fireEvent.click(actionIcon));

    expect(mockSetEntryBeingEdited).toHaveBeenCalledWith(stubEntryId);
  });
});
