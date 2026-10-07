import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import AddChecklistItemModal from './AddChecklistItemModal';

jest.mock(
  '@/features/settings/components/ai-agents/forms/swear/AddChecklistItemForm',
  () => {
    return function MockAddChecklistItemForm({
      aiAgentId,
      closeForm,
    }: {
      aiAgentId: string;
      closeForm: React.Dispatch<React.SetStateAction<boolean>>;
    }) {
      return (
        <div data-testid='add-form'>
          Form for {aiAgentId}
          <button onClick={() => closeForm(true)} data-testid='complete-form'>
            Complete
          </button>
        </div>
      );
    };
  }
);

describe('AddChecklistItemModal', () => {
  const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';
  const mockCloseModal = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render modal when opened', () => {
    render(
      <AddChecklistItemModal
        isOpened={true}
        closeModal={mockCloseModal}
        aiAgentId={mockAgentId}
      />
    );

    expect(screen.getByText('Add Checklist Item')).toBeInTheDocument();
    expect(screen.getByTestId('add-form')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <AddChecklistItemModal
        isOpened={false}
        closeModal={mockCloseModal}
        aiAgentId={mockAgentId}
      />
    );

    expect(screen.queryByText('Add Checklist Item')).not.toBeInTheDocument();
  });

  it('should close modal when form completed', async () => {
    render(
      <AddChecklistItemModal
        isOpened={true}
        closeModal={mockCloseModal}
        aiAgentId={mockAgentId}
      />
    );

    const completeButton = screen.getByTestId('complete-form');
    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(mockCloseModal).toHaveBeenCalled();
    });
  });

  it('should pass correct agentId to form', () => {
    render(
      <AddChecklistItemModal
        isOpened={true}
        closeModal={mockCloseModal}
        aiAgentId={mockAgentId}
      />
    );

    expect(screen.getByText(`Form for ${mockAgentId}`)).toBeInTheDocument();
  });
});
