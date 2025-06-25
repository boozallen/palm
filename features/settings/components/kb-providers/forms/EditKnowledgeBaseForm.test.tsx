import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import EditKnowledgeBaseForm from './EditKnowledgeBaseForm';
import useUpdateKnowledgeBase from '@/features/settings/api/update-knowledge-base';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

jest.mock('@/features/settings/api/update-knowledge-base');
jest.mock('@mantine/notifications');

describe('EditKnowledgeBaseForm', () => {
  const mockId = 'mock-id';
  const mockLabel = 'mock-label';
  const mockExternalId = 'mock-external-id';
  const mockSetEditKnowledgeBase = jest.fn();
  const mockMutation = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();

    (useUpdateKnowledgeBase as jest.Mock).mockReturnValue({
      mutateAsync: mockMutation,
      isPending: false,
      error: null,
    });

    render(
      <EditKnowledgeBaseForm
        id={mockId}
        label={mockLabel}
        externalId={mockExternalId}
        setEditKnowledgeBase={mockSetEditKnowledgeBase}
      />
    );
  });

  it('renders the form with initial values', () => {
    expect(screen.getByLabelText('Label')).toHaveValue(mockLabel);
    expect(screen.getByLabelText('External ID')).toHaveValue(mockExternalId);
  });

  it('updates the label value when input changes', () => {
    const newLabel = 'new-label';
    const labelInput = screen.getByLabelText('Label');

    fireEvent.change(labelInput, { target: { value: newLabel } });

    expect(labelInput).toHaveValue(newLabel);
  });

  it('updates the external ID value when input changes', () => {
    const newExternalId = 'new-external-id';
    const externalIdInput = screen.getByLabelText('External ID');

    fireEvent.change(externalIdInput, { target: { value: newExternalId } });

    expect(externalIdInput).toHaveValue(newExternalId);
  });

  it('calls the update knowledge base mutation when the form is submitted', async () => {
    const labelInput = screen.getByLabelText('Label');
    const externalIdInput = screen.getByLabelText('External ID');

    fireEvent.change(labelInput, { target: { value: 'new-label' } });
    fireEvent.change(externalIdInput, { target: { value: 'new-external-id' } });

    await act(async () => {
      mockMutation.mockResolvedValue({ success: true });
      fireEvent.submit(screen.getAllByRole('button')[0]);
    });

    expect(mockMutation).toHaveBeenCalledWith({
      id: mockId,
      label: 'new-label',
      externalId: 'new-external-id',
    });
  });

  it('shows notification on error', async () => {
    mockMutation.mockRejectedValue(Forbidden('Failed to update knowledge base'));

    const labelInput = screen.getByLabelText('Label');
    const externalIdInput = screen.getByLabelText('External ID');

    fireEvent.change(labelInput, { target: { value: 'new-label' } });
    fireEvent.change(externalIdInput, { target: { value: 'new-external-id' } });

    act(() => {
      fireEvent.submit(screen.getAllByRole('button')[0]);
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'edit-knowledge-base-failed',
        title: 'Failed to Save Changes',
        message: 'Unable to save your changes. Please try again later.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    });
  });

});
