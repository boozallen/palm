import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';
import AddModelForm from './AddModelForm';
import useAddAiProviderModel from '@/features/settings/api/ai-providers/add-ai-provider-model';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { TRPCClientError } from '@trpc/client';

// What the client actually receives for a CONFLICT: the server's error class is
// gone by this point, leaving the code on `data` and the message.
const conflictError = (message: string) => {
  const error = new TRPCClientError<never>(message);
  Object.defineProperty(error, 'data', { value: { code: 'CONFLICT' } });

  return error;
};

jest.mock('@/features/settings/api/ai-providers/add-ai-provider-model');
jest.mock('@mantine/notifications');

jest.mock('@/features/settings/utils/useTestModel', () => {
  return jest.fn(() => ({
    testModel: jest.fn(),
    error: null,
  }));
});

describe('AddModelForm', () => {
  const mockProviderId = 'mock-id';
  const mockName = 'mock-name';
  const mockExternalId = 'mock-external-id';
  const mockShowAddModelRow = jest.fn();
  const mockNewModelBeingTested = jest.fn();
  const mockMutation = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();

    (useAddAiProviderModel as jest.Mock).mockReturnValue({
      mutateAsync: mockMutation,
      isPending: false,
      error: null,
    });

    render(
      <AddModelForm
        providerId={mockProviderId}
        setShowAddModelRow={mockShowAddModelRow}
        setNewModelBeingTested={mockNewModelBeingTested}
      />,
    );
  });

  it('renders the form with initial values', () => {
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('External ID')).toHaveValue('');
    expect(screen.getByLabelText(/Input Token Cost/)).toHaveValue('0.00');
    expect(screen.getByLabelText(/Output Token Cost/)).toHaveValue('0.00');
  });

  it('updates the name value when input changes', () => {
    const nameInput = screen.getByLabelText('Name');

    fireEvent.change(nameInput, { target: { value: mockName } });

    expect(nameInput).toHaveValue(mockName);
  });

  it('updates the external ID value when input changes', () => {
    const externalIdInput = screen.getByLabelText('External ID');

    fireEvent.change(externalIdInput, { target: { value: mockExternalId } });

    expect(externalIdInput).toHaveValue(mockExternalId);
  });

  it('calls the update model mutation when the form is submitted', async () => {
    const nameInput = screen.getByLabelText('Name');
    const externalIdInput = screen.getByLabelText('External ID');

    fireEvent.change(nameInput, { target: { value: mockName } });
    fireEvent.change(externalIdInput, { target: { value: mockExternalId } });

    await act(async () => {
      mockMutation.mockResolvedValue({ success: true });
      fireEvent.submit(screen.getAllByRole('button')[0]);
    });

    expect(mockMutation).toHaveBeenCalledWith({
      name: mockName,
      externalId: mockExternalId,
      aiProviderId: mockProviderId,
      costPerMillionInputTokens: 0,
      costPerMillionOutputTokens: 0,
      embeddingsOnly: false,
    });
  });

  // The designation is made at creation so the model is never briefly available as
  // a chat model, and so the add path can enforce one per provider atomically.
  it('adds the model as embeddings only when the checkbox is checked', async () => {
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: mockName },
    });
    fireEvent.change(screen.getByLabelText('External ID'), {
      target: { value: mockExternalId },
    });
    fireEvent.click(screen.getByTestId('add-model-embeddings-only'));

    await act(async () => {
      mockMutation.mockResolvedValue({ id: 'new-model-id' });
      fireEvent.submit(screen.getAllByRole('button')[0]);
    });

    expect(mockMutation).toHaveBeenCalledWith({
      name: mockName,
      externalId: mockExternalId,
      aiProviderId: mockProviderId,
      costPerMillionInputTokens: 0,
      costPerMillionOutputTokens: 0,
      embeddingsOnly: true,
    });
  });

  // The chat completion the test sends would fail against an embedding model and
  // blame the admin's credentials for a correct configuration.
  it('skips the post-save model test for an embeddings-only model', async () => {
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: mockName },
    });
    fireEvent.change(screen.getByLabelText('External ID'), {
      target: { value: mockExternalId },
    });
    fireEvent.click(screen.getByTestId('add-model-embeddings-only'));

    await act(async () => {
      mockMutation.mockResolvedValue({ id: 'new-model-id' });
      fireEvent.submit(screen.getAllByRole('button')[0]);
    });

    expect(mockNewModelBeingTested).not.toHaveBeenCalled();
    expect(mockShowAddModelRow).toHaveBeenCalledWith({
      show: false,
      providerId: '',
    });
  });

  // The one-per-provider rejection names the model already designated, which is the
  // only way the admin can tell which row to delete first. It is recognized by the
  // CONFLICT code rather than the message: the DAL's error class does not survive
  // tRPC serialization, so only the code and message reach the client.
  it('surfaces the rejection when the provider already has an embeddings model', async () => {
    const message =
      'This provider already uses "Titan Text Embeddings V1" for embeddings. Delete that model first.';
    mockMutation.mockRejectedValue(conflictError(message));

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: mockName },
    });
    fireEvent.change(screen.getByLabelText('External ID'), {
      target: { value: mockExternalId },
    });
    fireEvent.click(screen.getByTestId('add-model-embeddings-only'));

    act(() => {
      fireEvent.submit(screen.getAllByRole('button')[0]);
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'add-model-failed',
        title: 'Failed to Create Model',
        message,
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    });
  });

  it('shows notification on error', async () => {
    mockMutation.mockRejectedValue(Forbidden('Failed to update model'));

    const nameInput = screen.getByLabelText('Name');
    const externalIdInput = screen.getByLabelText('External ID');

    fireEvent.change(nameInput, { target: { value: mockName } });
    fireEvent.change(externalIdInput, { target: { value: mockExternalId } });

    act(() => {
      fireEvent.submit(screen.getAllByRole('button')[0]);
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'add-model-failed',
        title: 'Failed to Create Model',
        message: 'Unable to create model. Please try again later.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    });
  });
});
