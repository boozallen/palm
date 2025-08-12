import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';
import EditModelForm from './EditModelForm';
import useUpdateAiProviderModel from '@/features/settings/api/update-ai-provider-model';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

jest.mock('@/features/settings/api/update-ai-provider-model');
jest.mock('@mantine/notifications');

jest.mock('@/features/settings/utils/useTestModel', () => {
  return jest.fn(() => ({
    testModel: jest.fn(),
    error: null,
  }));
});

describe('EditModelForm', () => {
  const mockId = 'mock-id';
  const mockName = 'mock-name';
  const mockExternalId = 'mock-external-id';
  const mockCostPerInputToken = 0;
  const mockCostPerOutputToken = 0;
  const mockSetEditModel = jest.fn();
  const mockMutation = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();

    (useUpdateAiProviderModel as jest.Mock).mockReturnValue({
      mutateAsync: mockMutation,
      isPending: false,
      error: null,
    });

    render(
      <EditModelForm
        id={mockId}
        name={mockName}
        externalId={mockExternalId}
        costPerMillionInputTokens={mockCostPerInputToken}
        costPerMillionOutputTokens={mockCostPerOutputToken}
        setEditModel={mockSetEditModel}
      />,
    );
  });

  it('renders the form with initial values', () => {
    expect(screen.getByLabelText('Name')).toHaveValue(mockName);
    expect(screen.getByLabelText('External ID')).toHaveValue(mockExternalId);
    expect(screen.getByLabelText(/Input Token Cost/)).toHaveValue(mockCostPerInputToken.toFixed(2));
    expect(screen.getByLabelText(/Output Token Cost/)).toHaveValue(mockCostPerOutputToken.toFixed(2));
  });

  it('updates the name value when input changes', () => {
    const newName = 'new-name';
    const nameInput = screen.getByLabelText('Name');

    fireEvent.change(nameInput, { target: { value: newName } });

    expect(nameInput).toHaveValue(newName);
  });

  it('updates the external ID value when input changes', () => {
    const newExternalId = 'new-external-id';
    const externalIdInput = screen.getByLabelText('External ID');

    fireEvent.change(externalIdInput, { target: { value: newExternalId } });

    expect(externalIdInput).toHaveValue(newExternalId);
  });

  it('calls the update model mutation when the form is submitted', async () => {
    const nameInput = screen.getByLabelText('Name');
    const externalIdInput = screen.getByLabelText('External ID');

    fireEvent.change(nameInput, { target: { value: 'new-name' } });
    fireEvent.change(externalIdInput, { target: { value: 'new-external-id' } });

    await act(async () => {
      mockMutation.mockResolvedValue({ success: true });
      fireEvent.submit(screen.getAllByRole('button')[0]);
    });

    expect(mockMutation).toHaveBeenCalledWith({
      id: mockId,
      name: 'new-name',
      externalId: 'new-external-id',
      costPerMillionInputTokens: 0,
      costPerMillionOutputTokens: 0,
    });
  });

  it('shows notification on error', async () => {
    mockMutation.mockRejectedValue(Forbidden('Failed to update model'));

    const nameInput = screen.getByLabelText('Name');
    const externalIdInput = screen.getByLabelText('External ID');

    fireEvent.change(nameInput, { target: { value: 'new-name' } });
    fireEvent.change(externalIdInput, { target: { value: 'new-external-id' } });

    act(() => {
      fireEvent.submit(screen.getAllByRole('button')[0]);
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'edit-model-failed',
        title: 'Failed to Save Changes',
        message: 'Unable to save your changes. Please try again later.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    });
  });
});
