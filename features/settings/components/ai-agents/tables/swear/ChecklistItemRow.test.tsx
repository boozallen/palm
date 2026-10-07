import { render, screen, fireEvent } from '@testing-library/react';

import ChecklistItemRow from './ChecklistItemRow';

jest.mock(
  '@/features/settings/components/ai-agents/modals/swear/DeleteChecklistItemModal',
  () => {
    return function MockDeleteModal({
      modalOpened,
    }: {
      modalOpened: boolean;
      closeModalHandler: () => void;
      itemId: string;
    }) {
      return modalOpened ? <div data-testid='delete-modal'>Delete Modal</div> : null;
    };
  }
);

jest.mock(
  '@/features/settings/components/ai-agents/modals/swear/EditChecklistItemModal',
  () => {
    return function MockEditModal({
      isOpened,
    }: {
      isOpened: boolean;
      closeModal: () => void;
      checklistItemId: string;
      initialValues: { category: string; item: string; sortOrder: number };
    }) {
      return isOpened ? <div data-testid='edit-modal'>Edit Modal</div> : null;
    };
  }
);

describe('ChecklistItemRow', () => {
  const mockChecklistItem = {
    id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
    aiAgentId: '212a5a1a-77a3-42e4-a143-7c43b87f0fd3',
    category: 'Preliminary Information',
    item: 'Have you identified the jurisdiction?',
    sortOrder: 1,
  };

  const renderWithTable = () => {
    return render(
      <table>
        <tbody>
          <ChecklistItemRow checklistItem={mockChecklistItem} />
        </tbody>
      </table>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render checklist item data', () => {
    renderWithTable();

    expect(screen.getByText('Preliminary Information')).toBeInTheDocument();
    expect(
      screen.getByText('Have you identified the jurisdiction?')
    ).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should render edit and delete buttons', () => {
    renderWithTable();

    expect(screen.getByLabelText('Edit checklist item')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete checklist item')).toBeInTheDocument();
  });

  it('should open edit modal when edit button clicked', () => {
    renderWithTable();

    const editButton = screen.getByLabelText('Edit checklist item');
    fireEvent.click(editButton);

    expect(screen.getByTestId('edit-modal')).toBeInTheDocument();
  });

  it('should open delete modal when delete button clicked', () => {
    renderWithTable();

    const deleteButton = screen.getByLabelText('Delete checklist item');
    fireEvent.click(deleteButton);

    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
  });

  it('should not show modals initially', () => {
    renderWithTable();

    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();
  });
});
