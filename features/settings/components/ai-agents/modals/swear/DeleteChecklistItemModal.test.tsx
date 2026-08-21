import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';

import DeleteChecklistItemModal from './DeleteChecklistItemModal';
import useDeleteSwearChecklistItem from '@/features/settings/api/ai-agents/swear/delete-swear-checklist-item';

jest.mock('@mantine/notifications');
jest.mock('@/features/settings/api/ai-agents/swear/delete-swear-checklist-item');

describe('DeleteChecklistItemModal', () => {
  const mockItemId = '10e0eba0-b782-491b-b609-b5c84cb0e17a';
  const mockCloseModalHandler = jest.fn();
  const mockDeleteChecklistItem = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useDeleteSwearChecklistItem as jest.Mock).mockReturnValue({
      mutateAsync: mockDeleteChecklistItem,
      isPending: false,
      error: null,
    });
  });

  it('should render modal when opened', () => {
    render(
      <DeleteChecklistItemModal
        modalOpened={true}
        closeModalHandler={mockCloseModalHandler}
        itemId={mockItemId}
      />
    );

    expect(screen.getByText('Delete SWEAR Checklist Item')).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to delete this checklist item?')
    ).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <DeleteChecklistItemModal
        modalOpened={false}
        closeModalHandler={mockCloseModalHandler}
        itemId={mockItemId}
      />
    );

    expect(
      screen.queryByText('Delete SWEAR Checklist Item')
    ).not.toBeInTheDocument();
  });

  it('should close modal when cancel clicked', () => {
    render(
      <DeleteChecklistItemModal
        modalOpened={true}
        closeModalHandler={mockCloseModalHandler}
        itemId={mockItemId}
      />
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(mockCloseModalHandler).toHaveBeenCalled();
  });

  it('should delete item when delete button clicked', async () => {
    mockDeleteChecklistItem.mockResolvedValue({});

    render(
      <DeleteChecklistItemModal
        modalOpened={true}
        closeModalHandler={mockCloseModalHandler}
        itemId={mockItemId}
      />
    );

    const deleteButton = screen.getByRole('button', { name: 'Delete Item' });
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    expect(mockDeleteChecklistItem).toHaveBeenCalledWith({ itemId: mockItemId });
    expect(mockCloseModalHandler).toHaveBeenCalled();
  });

  it('should show loading state while deleting', () => {
    (useDeleteSwearChecklistItem as jest.Mock).mockReturnValue({
      mutateAsync: mockDeleteChecklistItem,
      isPending: true,
      error: null,
    });

    render(
      <DeleteChecklistItemModal
        modalOpened={true}
        closeModalHandler={mockCloseModalHandler}
        itemId={mockItemId}
      />
    );

    expect(screen.getByRole('button', { name: 'Deleting Item' })).toBeInTheDocument();
  });

  it('should show error notification on failure', async () => {
    const mockError = new Error('Failed to delete');
    mockDeleteChecklistItem.mockRejectedValue(mockError);

    (useDeleteSwearChecklistItem as jest.Mock).mockReturnValue({
      mutateAsync: mockDeleteChecklistItem,
      isPending: false,
      error: { message: 'Failed to delete' },
    });

    render(
      <DeleteChecklistItemModal
        modalOpened={true}
        closeModalHandler={mockCloseModalHandler}
        itemId={mockItemId}
      />
    );

    const deleteButton = screen.getByRole('button', { name: 'Delete Item' });
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Remove checklist item failed',
          variant: 'failed_operation',
        })
      );
    });
  });
});
