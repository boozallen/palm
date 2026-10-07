import { fireEvent, render, screen } from '@testing-library/react';

import PinWorkflowGroupModal from './PinWorkflowGroupModal';

describe('PinWorkflowGroupModal', () => {
  const mockOnSelect = jest.fn();

  const groups = [
    { id: 'group-1', label: 'Group One' },
    { id: 'group-2', label: 'Group Two' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render when closed', () => {
    render(<PinWorkflowGroupModal opened={false} groups={groups} onSelect={mockOnSelect} />);

    expect(screen.queryByTestId('pin-workflow-group-select')).not.toBeInTheDocument();
  });

  it('renders the group options and a disabled continue button until one is selected', () => {
    render(<PinWorkflowGroupModal opened={true} groups={groups} onSelect={mockOnSelect} />);

    expect(screen.getByTestId('pin-workflow-group-select')).toBeInTheDocument();
    expect(screen.getByTestId('pin-workflow-group-continue-button')).toBeDisabled();
  });

  it('does not render a cancel/dismiss option, since the choice is mandatory', () => {
    render(<PinWorkflowGroupModal opened={true} groups={groups} onSelect={mockOnSelect} />);

    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });

  it('calls onSelect with the chosen group when Continue is clicked', () => {
    render(<PinWorkflowGroupModal opened={true} groups={groups} onSelect={mockOnSelect} />);

    fireEvent.mouseDown(screen.getByTestId('pin-workflow-group-select'));
    fireEvent.mouseDown(screen.getByText('Group Two'));
    fireEvent.click(screen.getByTestId('pin-workflow-group-continue-button'));

    expect(mockOnSelect).toHaveBeenCalledWith('group-2');
  });

  it('does not call onSelect when Continue is clicked with no group chosen', () => {
    render(<PinWorkflowGroupModal opened={true} groups={groups} onSelect={mockOnSelect} />);

    fireEvent.click(screen.getByTestId('pin-workflow-group-continue-button'));

    expect(mockOnSelect).not.toHaveBeenCalled();
  });
});
