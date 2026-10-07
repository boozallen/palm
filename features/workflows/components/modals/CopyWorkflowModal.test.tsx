import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CopyWorkflowModal from './CopyWorkflowModal';

describe('CopyWorkflowModal', () => {
  const defaultProps = {
    modalOpened: true,
    closeModalHandler: jest.fn(),
    workflowName: 'My Workflow',
    onConfirm: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the modal with workflow name in confirmation text', () => {
    render(<CopyWorkflowModal {...defaultProps} />);

    expect(screen.getByText('Confirm workflow copy')).toBeInTheDocument();
    expect(screen.getByTestId('body-text')).toHaveTextContent(
      'Are you sure you want to copy the "My Workflow" workflow?',
    );
  });

  it('renders Cancel and Copy buttons', () => {
    render(<CopyWorkflowModal {...defaultProps} />);

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('calls closeModalHandler when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<CopyWorkflowModal {...defaultProps} />);

    await user.click(screen.getByText('Cancel'));

    expect(defaultProps.closeModalHandler).toHaveBeenCalledTimes(1);
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm and closeModalHandler when Copy is clicked', async () => {
    const user = userEvent.setup();
    render(<CopyWorkflowModal {...defaultProps} />);

    await user.click(screen.getByText('Copy'));

    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    expect(defaultProps.closeModalHandler).toHaveBeenCalledTimes(1);
  });

  it('does not render content when modalOpened is false', () => {
    render(<CopyWorkflowModal {...defaultProps} modalOpened={false} />);

    expect(screen.queryByText('Confirm workflow copy')).not.toBeInTheDocument();
  });
});
