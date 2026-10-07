import { useRouter } from 'next/router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CreatePromptMenu from './CreatePromptMenu';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

describe('CreatePromptMenu', () => {
  const expandMenu = () => {
    const menuTarget = screen.getByText('Create Prompt');
    fireEvent.click(menuTarget);
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
    });

    render(<CreatePromptMenu />);
  });

  it('renders menu target and items', () => {
    expect(screen.getByText('Create Prompt')).toBeInTheDocument();
    expect(screen.queryByText('Generate Prompt')).not.toBeInTheDocument();
    expect(screen.queryByText('Add New Prompt')).not.toBeInTheDocument();
  });

  it('calls router.push when Add New Prompt is clicked', () => {
    expandMenu();
    fireEvent.click(screen.getByText('Add New Prompt'));

    expect(useRouter().push).toHaveBeenCalledWith('/library/add');
    expect(useRouter().push).toHaveBeenCalledTimes(1);
  });

  it('calls router.push when Generate Prompt is clicked', () => {
    expandMenu();
    fireEvent.click(screen.getByText('Generate Prompt'));

    expect(useRouter().push).toHaveBeenCalledWith('/prompt-generator');
    expect(useRouter().push).toHaveBeenCalledTimes(1);
  });

  it('displays tooltip for generate prompt', async () => {
    expandMenu();

    const tooltipText = 'Use the power of AI to generate a new prompt';
    expect(screen.queryByText(tooltipText)).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText('Generate Prompt'));

    await waitFor(() => {
      expect(screen.queryByText(tooltipText)).toBeInTheDocument();
    });
  });

  it('displays tooltip for add new prompt', async () => {
    expandMenu();

    const tooltipText = 'Manually create a new prompt from scratch';
    expect(screen.queryByText(tooltipText)).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText('Add New Prompt'));

    await waitFor(() => {
      expect(screen.queryByText(tooltipText)).toBeInTheDocument();
    });
  });

});
