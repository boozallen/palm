import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import RegenerateChatResponse from './RegenerateChatResponse';
import { useDisclosure } from '@mantine/hooks';
import useRegenerateResponse from '@/features/chat/hooks/useRegenerateResponse';
import { useChat } from '@/features/chat/providers/ChatProvider';
import useGetAvailableModels from '@/features/shared/api/get-available-models';

jest.mock('@mantine/hooks');

jest.mock('@/features/shared/api/get-available-models');
jest.mock('@/features/chat/hooks/useRegenerateResponse');
jest.mock('@/features/chat/providers/ChatProvider', () => ({
  useChat: jest.fn(),
}));
jest.mock('@/features/chat/components/modals/RegenerateResponseModal', () => {
  return jest.fn(() => <div>RegenerateResponseModal</div>);
});

describe('RegenerateChatResponse', () => {
  let opened = false;
  const open = jest.fn(() => opened = true);
  const close = jest.fn(() => opened = false);
  const mutateAsync = jest.fn();

  const stubMessageId = '6af542fc-ba3f-4fb7-9605-376e574c39d5';
  const stubModelId = '4fc82bb9-3205-4bb8-a665-38ade5eeeb5a';

  beforeEach(() => {
    jest.clearAllMocks();

    (useDisclosure as jest.Mock).mockReturnValueOnce([
      opened, { open, close },
    ]);

    (useRegenerateResponse as jest.Mock).mockReturnValueOnce({
      mutateAsync,
    });

    (useChat as jest.Mock).mockReturnValue({
      modelId: stubModelId,
    });

    (useGetAvailableModels as jest.Mock).mockReturnValue({
      data: { availableModels: [{ id: stubModelId }] },
    });

    Storage.prototype.getItem = jest.fn(() => 'false');
  });

  it('renders action icon (button)', () => {
    render(<RegenerateChatResponse messageId={stubMessageId} />);

    const actionIcon = screen.getByRole('button');
    expect(actionIcon).toBeInTheDocument();
  });

  it('does not render tooltip by default', () => {
    render(<RegenerateChatResponse messageId={stubMessageId} />);

    const tooltip = screen.queryByRole('tooltip');
    expect(tooltip).not.toBeInTheDocument();
  });

  it('displays tooltip on hover', () => {
    render(<RegenerateChatResponse messageId={stubMessageId} />);

    const actionIcon = screen.getByRole('button');
    fireEvent.mouseEnter(actionIcon);

    waitFor(() => {
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
    });
  });

  it('renders refresh icon', () => {
    render(<RegenerateChatResponse messageId={stubMessageId} />);

    const refreshIcon = screen.getByLabelText('Retry');
    expect(refreshIcon).toBeInTheDocument();
  });

  it('calls open function when actionIcon is clicked', () => {
    render(<RegenerateChatResponse messageId={stubMessageId} />);

    expect(open).not.toHaveBeenCalled();

    const actionIcon = screen.getByRole('button');
    fireEvent.click(actionIcon);

    expect(open).toHaveBeenCalled();
    expect(opened).toEqual(true);
  });

  it('renders modal', () => {
    render(<RegenerateChatResponse messageId={stubMessageId} />);

    expect(screen.getByText('RegenerateResponseModal')).toBeInTheDocument();
  });

  it('does not open modal if user chose to hide message', () => {
    Storage.prototype.getItem = jest.fn(() => 'true');

    render(<RegenerateChatResponse messageId={stubMessageId} />);

    const actionIcon = screen.getByRole('button');
    fireEvent.click(actionIcon);

    expect(open).not.toHaveBeenCalled();
    expect(mutateAsync).toHaveBeenCalled();
  });

  it('disables action icon if model is no longer available', () => {
    (useGetAvailableModels as jest.Mock).mockReturnValueOnce({
      data: { availableModels: [{ id: 'test-123' }] },
    });

    render(<RegenerateChatResponse messageId={stubMessageId} />);

    const actionIcon = screen.getByRole('button');

    expect(actionIcon).toBeDisabled();
  });

  it('displays different tooltip on hover if icon is disabled', () => {
    (useGetAvailableModels as jest.Mock).mockReturnValueOnce({
      data: { availableModels: [{ id: 'test-123' }] },
    });

    render(<RegenerateChatResponse messageId={stubMessageId} />);

    const actionIcon = screen.getByRole('button');
    fireEvent.mouseEnter(actionIcon);

    waitFor(() => {
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent(/model is no longer available/i);
    });
  });
});
