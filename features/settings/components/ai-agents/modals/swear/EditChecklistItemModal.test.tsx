import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import EditChecklistItemModal from './EditChecklistItemModal';

jest.mock(
  '@/features/settings/components/ai-agents/forms/swear/EditChecklistItemForm',
  () => {
    return function MockEditChecklistItemForm({
      checklistItemId,
      closeForm,
    }: {
      checklistItemId: string;
      initialValues: { category: string; item: string; sortOrder: number };
      closeForm: React.Dispatch<React.SetStateAction<boolean>>;
    }) {
      return (
        <div data-testid='edit-form'>
          Form for {checklistItemId}
          <button onClick={() => closeForm(true)} data-testid='complete-form'>
            Complete
          </button>
        </div>
      );
    };
  }
);

describe('EditChecklistItemModal', () => {
  const mockItemId = '10e0eba0-b782-491b-b609-b5c84cb0e17a';
  const mockCloseModal = jest.fn();
  const mockInitialValues = {
    category: 'Preliminary Information',
    item: 'Test item',
    sortOrder: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render modal when opened', () => {
    render(
      <EditChecklistItemModal
        isOpened={true}
        closeModal={mockCloseModal}
        checklistItemId={mockItemId}
        initialValues={mockInitialValues}
      />
    );

    expect(screen.getByText('Edit Checklist Item')).toBeInTheDocument();
    expect(screen.getByTestId('edit-form')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <EditChecklistItemModal
        isOpened={false}
        closeModal={mockCloseModal}
        checklistItemId={mockItemId}
        initialValues={mockInitialValues}
      />
    );

    expect(screen.queryByText('Edit Checklist Item')).not.toBeInTheDocument();
  });

  it('should close modal when form completed', async () => {
    render(
      <EditChecklistItemModal
        isOpened={true}
        closeModal={mockCloseModal}
        checklistItemId={mockItemId}
        initialValues={mockInitialValues}
      />
    );

    const completeButton = screen.getByTestId('complete-form');
    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(mockCloseModal).toHaveBeenCalled();
    });
  });

  it('should pass correct itemId to form', () => {
    render(
      <EditChecklistItemModal
        isOpened={true}
        closeModal={mockCloseModal}
        checklistItemId={mockItemId}
        initialValues={mockInitialValues}
      />
    );

    expect(screen.getByText(`Form for ${mockItemId}`)).toBeInTheDocument();
  });
});
