import React from 'react';
import { notifications } from '@mantine/notifications';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import EditDocumentUploadProviderForm from './EditDocumentUploadProviderForm';
import { DocumentUploadProviderType, SanitizedDocumentUploadProvider } from '@/features/shared/types/document-upload-provider';
import useUpdateDocumentUploadProvider from '@/features/settings/api/document-upload/update-document-upload-provider';

globalThis.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@mantine/notifications');
jest.mock('@/features/settings/api/document-upload/update-document-upload-provider');
jest.mock('@/features/shared/components/forms/PasswordInputPlaceholder', () => ({
  PasswordInputPlaceholder: ({ label, handleReplace }: { label: string; handleReplace: () => void }) => (
    <div data-testid={`placeholder-${label.toLowerCase().replaceAll(' ', '-')}`}>
      <span>{label}</span>
      <button type='button' onClick={handleReplace}>Replace</button>
    </div>
  ),
}));

const mockProvider: SanitizedDocumentUploadProvider = {
  id: 'uuid-123',
  label: 'My Provider',
  providerType: DocumentUploadProviderType.AWS,
  sourceUri: 's3://existing-bucket/key',
};

const setFormCompleted = jest.fn();

function renderForm(provider = mockProvider) {
  return render(
    <EditDocumentUploadProviderForm
      provider={provider}
      setFormCompleted={setFormCompleted}
    />
  );
}

describe('EditDocumentUploadProviderForm', () => {
  const mockUpdateProvider = useUpdateDocumentUploadProvider as jest.Mock;
  const mutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateProvider.mockReturnValue({ mutateAsync, isPending: false });
  });

  it('renders base fields pre-populated from provider', () => {
    renderForm();

    expect(screen.getByLabelText(/Label/i)).toHaveValue('My Provider');
    expect(screen.getByLabelText(/S3 URI/i)).toHaveValue('s3://existing-bucket/key');
  });

  it('renders credential placeholders by default', () => {
    renderForm();

    expect(screen.getByTestId('placeholder-access-key-id')).toBeInTheDocument();
    expect(screen.getByTestId('placeholder-secret-access-key')).toBeInTheDocument();
    expect(screen.getByTestId('placeholder-session-token')).toBeInTheDocument();
  });

  it('shows password input after clicking Replace for Access Key ID', async () => {
    renderForm();

    const replaceButtons = screen.getAllByRole('button', { name: /Replace/i });
    await userEvent.click(replaceButtons[0]);

    expect(screen.getByPlaceholderText(/Enter access key ID/i)).toBeInTheDocument();
    expect(screen.queryByTestId('placeholder-access-key-id')).not.toBeInTheDocument();
  });

  it('shows password input after clicking Replace for Secret Access Key', async () => {
    renderForm();

    const replaceButtons = screen.getAllByRole('button', { name: /Replace/i });
    await userEvent.click(replaceButtons[1]);

    expect(screen.getByPlaceholderText(/Enter secret access key/i)).toBeInTheDocument();
  });

  it('calls setFormCompleted when Cancel is clicked', async () => {
    renderForm();

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    });

    waitFor(() => {
      expect(setFormCompleted).toHaveBeenCalledTimes(1);
    });
  });

  it('submits with empty credentials when no fields are replaced', () => {
    renderForm();

    const submitButton = screen.getByRole('button', { name: /Save Changes/i });
    act(() => {
      fireEvent.click(submitButton);
    });

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: mockProvider.id,
        label: mockProvider.label,
        config: expect.objectContaining({
          providerType: DocumentUploadProviderType.AWS,
          accessKeyId: '',
          secretAccessKey: '',
          s3Uri: mockProvider.sourceUri,
        }),
      })
    );
  });

  it('submits new credential value after replacing access key', async () => {
    renderForm();

    const replaceButtons = screen.getAllByRole('button', { name: /Replace/i });
    await userEvent.click(replaceButtons[0]);

    const accessKeyInput = screen.getByPlaceholderText(/Enter access key ID/i);
    await userEvent.type(accessKeyInput, 'NEW_KEY');

    const submitButton = screen.getByRole('button', { name: /Save Changes/i });
    act(() => {
      fireEvent.click(submitButton);
    });

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ accessKeyId: 'NEW_KEY' }),
      })
    );
  });

  it('shows validation error if s3Uri is cleared', async () => {
    renderForm();

    await userEvent.clear(screen.getByLabelText(/S3 URI/i));
    await userEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    expect(await screen.findByText(/required/i)).toBeInTheDocument();
  });

  it('displays error notification if mutate throws', () => {
    renderForm();

    mutateAsync.mockRejectedValueOnce(new Error('Update failed'));

    const submitButton = screen.getByRole('button', { name: /Save Changes/i });
    act(() => {
      fireEvent.click(submitButton);
    });

    waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Update failed',
          variant: 'failed_operation',
        })
      );
    });
  });
});
