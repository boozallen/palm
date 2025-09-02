import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import AddKnowledgeBaseForm from './AddKnowledgeBaseForm';
import useCreateKnowledgeBase from '@/features/settings/api/kb-providers/create-knowledge-base';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

jest.mock('@/features/settings/api/kb-providers/create-knowledge-base');
jest.mock('@mantine/notifications');

describe('AddKnowledgeBaseForm', () => {
  const mockKbProviderId = 'mock-id';
  const mockLabel = 'mock-name';
  const mockExternalId = 'mock-external-id';
  const mockShowAddKnowledgeBaseRow = jest.fn();
  const mockMutation = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();

    (useCreateKnowledgeBase as jest.Mock).mockReturnValue({
      mutateAsync: mockMutation,
      isPending: false,
      error: null,
    });

    render(
      <AddKnowledgeBaseForm
        kbProviderId={mockKbProviderId}
        setShowAddKnowledgeBaseRow={mockShowAddKnowledgeBaseRow}
      />
    );
  });

  it('renders the form with initial values', () => {
    expect(screen.getByLabelText('Label')).toHaveValue('');
    expect(screen.getByLabelText('External ID')).toHaveValue('');
  });

  it('updates the label value when input changes', () => {
    const labelInput = screen.getByLabelText('Label');

    fireEvent.change(labelInput, { target: { value: mockLabel } });

    expect(labelInput).toHaveValue(mockLabel);
  });

  it('updates the external ID value when input changes', () => {
    const externalIdInput = screen.getByLabelText('External ID');

    fireEvent.change(externalIdInput, { target: { value: mockExternalId } });

    expect(externalIdInput).toHaveValue(mockExternalId);
  });

  it('calls the create knowledge base mutation when the form is submitted', async () => {
    const labelInput = screen.getByLabelText('Label');
    const externalIdInput = screen.getByLabelText('External ID');

    fireEvent.change(labelInput, { target: { value: mockLabel } });
    fireEvent.change(externalIdInput, { target: { value: mockExternalId } });

    await act(async () => {
      mockMutation.mockResolvedValue({ success: true });
      fireEvent.submit(screen.getAllByRole('button')[0]);
    });

    expect(mockMutation).toHaveBeenCalledWith({
      label: mockLabel,
      externalId: mockExternalId,
      kbProviderId: mockKbProviderId,
    });
  });

  it('shows notification on error', async () => {
    mockMutation.mockRejectedValue(Forbidden('Failed to create knowledge base'));

    const labelInput = screen.getByLabelText('Label');
    const externalIdInput = screen.getByLabelText('External ID');

    fireEvent.change(labelInput, { target: { value: mockLabel } });
    fireEvent.change(externalIdInput, { target: { value: mockExternalId } });

    act(() => {
      fireEvent.submit(screen.getAllByRole('button')[0]);
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'add-knowledge-base-failed',
        title: 'Failed to Create Knowledge Base',
        message: 'Unable to create knowledge base. Please try again later.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    });
  });

});
