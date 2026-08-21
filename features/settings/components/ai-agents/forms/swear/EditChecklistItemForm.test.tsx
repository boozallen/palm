import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';

import EditChecklistItemForm from './EditChecklistItemForm';
import useUpdateSwearChecklistItem from '@/features/settings/api/ai-agents/swear/update-swear-checklist-item';

jest.mock('@mantine/notifications');
jest.mock('@/features/settings/api/ai-agents/swear/update-swear-checklist-item');

describe('EditChecklistItemForm', () => {
  const mockItemId = '10e0eba0-b782-491b-b609-b5c84cb0e17a';
  const mockCloseForm = jest.fn();
  const mockUpdateChecklistItem = jest.fn();

  const mockInitialValues = {
    category: 'Preliminary Information',
    item: 'Initial item text',
    sortOrder: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useUpdateSwearChecklistItem as jest.Mock).mockReturnValue({
      mutateAsync: mockUpdateChecklistItem,
      isPending: false,
      error: null,
    });
  });

  it('should render form with initial values', () => {
    render(
      <EditChecklistItemForm
        checklistItemId={mockItemId}
        initialValues={mockInitialValues}
        closeForm={mockCloseForm}
      />
    );

    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Checklist Item')).toHaveValue('Initial item text');
    expect(screen.getByLabelText('Sort Order')).toHaveValue('1');
    expect(screen.getByRole('button', { name: 'Update Item' })).toBeInTheDocument();
  });

  it('should close form when cancel clicked', () => {
    render(
      <EditChecklistItemForm
        checklistItemId={mockItemId}
        initialValues={mockInitialValues}
        closeForm={mockCloseForm}
      />
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(mockCloseForm).toHaveBeenCalledWith(true);
  });

  it('should submit form with updated values', async () => {
    mockUpdateChecklistItem.mockResolvedValue({});

    render(
      <EditChecklistItemForm
        checklistItemId={mockItemId}
        initialValues={mockInitialValues}
        closeForm={mockCloseForm}
      />
    );

    // Update item text
    const itemInput = screen.getByLabelText('Checklist Item');
    fireEvent.change(itemInput, { target: { value: 'Updated item text' } });

    // Update sort order
    const sortOrderInput = screen.getByLabelText('Sort Order');
    fireEvent.change(sortOrderInput, { target: { value: '5' } });

    // Submit form
    const submitButton = screen.getByRole('button', { name: 'Update Item' });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(mockUpdateChecklistItem).toHaveBeenCalledWith({
        id: mockItemId,
        category: 'Preliminary Information',
        item: 'Updated item text',
        sortOrder: 5,
      });
    });
  });

  it('should show loading state while submitting', () => {
    (useUpdateSwearChecklistItem as jest.Mock).mockReturnValue({
      mutateAsync: mockUpdateChecklistItem,
      isPending: true,
      error: null,
    });

    render(
      <EditChecklistItemForm
        checklistItemId={mockItemId}
        initialValues={mockInitialValues}
        closeForm={mockCloseForm}
      />
    );

    expect(screen.getByRole('button', { name: 'Updating Item' })).toBeInTheDocument();
  });

  it('should show error notification on failure', async () => {
    const mockError = new Error('Failed to update');
    mockUpdateChecklistItem.mockRejectedValue(mockError);

    (useUpdateSwearChecklistItem as jest.Mock).mockReturnValue({
      mutateAsync: mockUpdateChecklistItem,
      isPending: false,
      error: { message: 'Failed to update' },
    });

    render(
      <EditChecklistItemForm
        checklistItemId={mockItemId}
        initialValues={mockInitialValues}
        closeForm={mockCloseForm}
      />
    );

    // Submit form
    const submitButton = screen.getByRole('button', { name: 'Update Item' });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to Update Checklist Item',
          variant: 'failed_operation',
        })
      );
    });
  });
});
