import React from 'react';
import { notifications } from '@mantine/notifications';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AddDocumentUploadProviderForm from './AddDocumentUploadProviderForm';
import { DocumentUploadProviderType } from '@/features/shared/types/document-upload-provider';
import useCreateDocumentUploadProvider from '@/features/settings/api/document-upload/create-document-upload-provider';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@mantine/notifications');

jest.mock('@/features/settings/api/document-upload/create-document-upload-provider');
jest.mock('@/features/settings/components/document-upload/forms/AddAwsProviderConfigForm', () => {
  return function mockAwsConfigForm({ form }: { form: any }) {
    return (
      <div data-testid='mock-aws-config'>
        <input
          data-testid='accessKeyId'
          {...form.getInputProps('config.accessKeyId')}
        />
        <input
          data-testid='secretAccessKey'
          {...form.getInputProps('config.secretAccessKey')}
        />
        <input
          data-testid='region'
          {...form.getInputProps('config.region')}
        />
        <input
          data-testid='s3Uri'
          {...form.getInputProps('config.s3Uri')}
        />
      </div>
    );
  };
});

// Helper to render with required props
const setFormCompleted = jest.fn();
function renderAddProviderForm(props: Partial<React.ComponentProps<typeof AddDocumentUploadProviderForm>> = {}) {

  return {
    ...render(
      <AddDocumentUploadProviderForm
        setFormCompleted={setFormCompleted}
        {...props}
      />
    ),
  };
}

describe('AddDocumentUploadProviderForm', () => {

  const mockCreateProvider = useCreateDocumentUploadProvider as jest.Mock;
  const mutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockCreateProvider.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
  });

  it('renders base fields by default', () => {
    renderAddProviderForm();

    expect(screen.getByLabelText(/Document Upload Provider/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Label/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Provider/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('renders aws config fields by default', () => {
    renderAddProviderForm();

    const awsConfigForm = screen.getByTestId('mock-aws-config');

    expect(awsConfigForm).toBeInTheDocument();
  });

  it('calls setFormCompleted when Cancel is clicked', async () => {
    renderAddProviderForm();

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    });

    waitFor(() => {
      expect(setFormCompleted).toHaveBeenCalledTimes(1);
    });
  });

  it('shows validation errors if base fields are empty', async () => {
    renderAddProviderForm();
    await userEvent.clear(screen.getByLabelText(/Label/i));
    await userEvent.click(screen.getByRole('button', { name: /Add Provider/i }));

    // Wait for validation error to appear
    expect(await screen.findByText(/required/i)).toBeInTheDocument();
  });

  it('calls mutateAsync upon submission', () => {
    renderAddProviderForm();

    const labelInput = screen.getByLabelText('Label');
    const s3UriInput = screen.getByTestId('s3Uri');
    fireEvent.change(labelInput, { target: { value: 'Test Label' } });
    fireEvent.change(s3UriInput, { target: { value: 's3://test-bucket' } });

    const submitButton = screen.getByRole('button', { name: /Add Provider/i });
    act(() => {
      fireEvent.click(submitButton);
    });

    expect(mutateAsync).toHaveBeenCalledWith({
      label: 'Test Label',
      config: {
        providerType: DocumentUploadProviderType.AWS,
        accessKeyId: '',
        secretAccessKey: '',
        sessionToken: '',
        region: '',
        s3Uri: 's3://test-bucket',
      },
    });
  });

  it('displays error notification if mutate throws', () => {
    renderAddProviderForm();

    mutateAsync.mockRejectedValueOnce(new Error('Test error'));

    const labelInput = screen.getByLabelText('Label');
    const s3UriInput = screen.getByTestId('s3Uri');
    fireEvent.change(labelInput, { target: { value: 'Test Label' } });
    fireEvent.change(s3UriInput, { target: { value: 's3://test-bucket' } });

    const submitButton = screen.getByRole('button', { name: /Add Provider/i });
    act(() => {
      fireEvent.click(submitButton);
    });

    waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Test Error',
        variant: 'failed_operation',
      }));
    });
  });
});
