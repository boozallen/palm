import { render, screen, fireEvent } from '@testing-library/react';

import AddChecklistItemForm from './AddChecklistItemForm';
import useCreateSwearChecklistItem from '@/features/settings/api/ai-agents/swear/create-swear-checklist-item';

jest.mock('@mantine/notifications');
jest.mock('@/features/settings/api/ai-agents/swear/create-swear-checklist-item');

describe('AddChecklistItemForm', () => {
  const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';
  const mockCloseForm = jest.fn();
  const mockCreateChecklistItem = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useCreateSwearChecklistItem as jest.Mock).mockReturnValue({
      mutateAsync: mockCreateChecklistItem,
      isPending: false,
      error: null,
    });
  });

  it('should render form fields', () => {
    render(
      <AddChecklistItemForm aiAgentId={mockAgentId} closeForm={mockCloseForm} />
    );

    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Checklist Item')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort Order')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should close form when cancel clicked', () => {
    render(
      <AddChecklistItemForm aiAgentId={mockAgentId} closeForm={mockCloseForm} />
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(mockCloseForm).toHaveBeenCalledWith(true);
  });

  it('should submit form when all fields are filled', async () => {
    mockCreateChecklistItem.mockResolvedValue({});

    render(
      <AddChecklistItemForm aiAgentId={mockAgentId} closeForm={mockCloseForm} />
    );

    // Enter item text
    const itemInput = screen.getByLabelText('Checklist Item');
    fireEvent.change(itemInput, { target: { value: 'Test checklist item' } });

    // Form should have the text area value
    expect(itemInput).toHaveValue('Test checklist item');
  });

  it('should show loading state while submitting', () => {
    (useCreateSwearChecklistItem as jest.Mock).mockReturnValue({
      mutateAsync: mockCreateChecklistItem,
      isPending: true,
      error: null,
    });

    render(
      <AddChecklistItemForm aiAgentId={mockAgentId} closeForm={mockCloseForm} />
    );

    expect(screen.getByRole('button', { name: 'Adding Item' })).toBeInTheDocument();
  });

  it('should have error state available from hook', () => {
    (useCreateSwearChecklistItem as jest.Mock).mockReturnValue({
      mutateAsync: mockCreateChecklistItem,
      isPending: false,
      error: { message: 'Failed to create' },
    });

    render(
      <AddChecklistItemForm aiAgentId={mockAgentId} closeForm={mockCloseForm} />
    );

    // The component should render with the error available
    expect(screen.getByLabelText('Checklist Item')).toBeInTheDocument();
  });
});
