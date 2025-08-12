import { fireEvent, render, screen } from '@testing-library/react';

import RegenerateChatResponse from './RegenerateChatResponse';
import useRegenerateResponse from '@/features/chat/hooks/useRegenerateResponse';

jest.mock('@/features/chat/hooks/useRegenerateResponse');

describe('RegenerateChatResponse', () => {
  const mutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useRegenerateResponse as jest.Mock).mockReturnValue({
      mutateAsync,
    });
  });

  it('renders action icon (button)', () => {
    render(<RegenerateChatResponse />);

    const actionIcon = screen.getByRole('button');
    expect(actionIcon).toBeInTheDocument();
  });

  it('does not render tooltip by default', () => {
    render(<RegenerateChatResponse />);

    const tooltip = screen.queryByRole('tooltip');
    expect(tooltip).not.toBeInTheDocument();
  });

  it('displays tooltip on hover', () => {
    render(<RegenerateChatResponse />);

    const actionIcon = screen.getByRole('button');
    fireEvent.mouseEnter(actionIcon);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
  });

  it('renders refresh icon', () => {
    render(<RegenerateChatResponse />);

    const refreshIcon = screen.getByLabelText('Retry');
    expect(refreshIcon).toBeInTheDocument();
  });

  it('calls mutate method when actionIcon is clicked', () => {
    render(<RegenerateChatResponse />);

    expect(mutateAsync).not.toHaveBeenCalled();

    const actionIcon = screen.getByRole('button');
    fireEvent.click(actionIcon);

    expect(mutateAsync).toHaveBeenCalled();
  });
});
