import { render, screen, fireEvent } from '@testing-library/react';

import AgentChecklistItems from './AgentChecklistItems';

jest.mock('../../tables/swear/ChecklistItemTable', () => {
  return function MockChecklistItemTable({ aiAgentId }: { aiAgentId: string }) {
    return <div data-testid='checklist-table'>Table for {aiAgentId}</div>;
  };
});

jest.mock('../../modals/swear/AddChecklistItemModal', () => {
  return function MockAddChecklistItemModal({
    isOpened,
    aiAgentId,
  }: {
    isOpened: boolean;
    closeModal: () => void;
    aiAgentId: string;
  }) {
    return isOpened ? (
      <div data-testid='add-modal'>Add Modal for {aiAgentId}</div>
    ) : null;
  };
});

describe('AgentChecklistItems', () => {
  const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render title and add button', () => {
    render(<AgentChecklistItems aiAgentId={mockAgentId} />);

    expect(screen.getByText('Checklist Items')).toBeInTheDocument();
    expect(screen.getByLabelText('Add New Checklist Item')).toBeInTheDocument();
  });

  it('should render checklist table', () => {
    render(<AgentChecklistItems aiAgentId={mockAgentId} />);

    expect(screen.getByTestId('checklist-table')).toBeInTheDocument();
    expect(screen.getByText(`Table for ${mockAgentId}`)).toBeInTheDocument();
  });

  it('should not show modal initially', () => {
    render(<AgentChecklistItems aiAgentId={mockAgentId} />);

    expect(screen.queryByTestId('add-modal')).not.toBeInTheDocument();
  });

  it('should open modal when add button clicked', () => {
    render(<AgentChecklistItems aiAgentId={mockAgentId} />);

    const addButton = screen.getByLabelText('Add New Checklist Item');
    fireEvent.click(addButton);

    expect(screen.getByTestId('add-modal')).toBeInTheDocument();
  });
});
