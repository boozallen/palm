import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';

import DocumentLibraryDocumentUploadProviderConfigRow from './DocumentLibraryDocumentUploadProviderConfigRow';
import getDocumentUploadProviders from '@/features/settings/api/document-upload/get-document-upload-providers';
import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';
import { SystemConfigFields } from '@/features/shared/types';

jest.mock('@/features/settings/api/document-upload/get-document-upload-providers');
jest.mock('@/features/settings/api/system-configurations/update-system-config');
jest.mock('@mantine/notifications', () => ({
  notifications: {
    show: jest.fn(),
  },
}));

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe('DocumentLibraryDocumentUploadProviderConfigRow', () => {
  const mockUpdateSystemConfig = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (getDocumentUploadProviders as jest.Mock).mockReturnValue({
      data: {
        providers: [
          { id: '1', label: 'Provider 1' },
          { id: '2', label: 'Provider 2' },
          { id: '3', label: 'Provider 3' },
        ],
      },
      isPending: false,
      error: null,
    });

    (useUpdateSystemConfig as jest.Mock).mockReturnValue({
      mutateAsync: mockUpdateSystemConfig,
    });
  });

  it('renders without crashing', () => {
    render(
      <table>
        <tbody>
          <DocumentLibraryDocumentUploadProviderConfigRow documentUploadProviderId={null} />
        </tbody>
      </table>
    );

    const row = screen.getByTestId('document-library-document-upload-provider-config-row');
    expect(row).toBeInTheDocument();
  });

  it('renders loading state', () => {
    (getDocumentUploadProviders as jest.Mock).mockReturnValueOnce({
      data: null,
      isPending: true,
      error: null,
    });

    render(
      <table>
        <tbody>
          <DocumentLibraryDocumentUploadProviderConfigRow documentUploadProviderId={null} />
        </tbody>
      </table>
    );

    expect(screen.getByTestId('centered-loader')).toBeInTheDocument();
  });

  it('renders error state', () => {
    (getDocumentUploadProviders as jest.Mock).mockReturnValueOnce({
      data: null,
      isPending: false,
      error: { message: 'Error fetching providers' },
    });

    render(
      <table>
        <tbody>
          <DocumentLibraryDocumentUploadProviderConfigRow documentUploadProviderId={null} />
        </tbody>
      </table>
    );

    expect(screen.getByText('Error fetching providers')).toBeInTheDocument();
  });

  it('renders Select with correct options', async () => {
    render(
      <table>
        <tbody>
          <DocumentLibraryDocumentUploadProviderConfigRow documentUploadProviderId={null} />
        </tbody>
      </table>
    );

    const select = screen.getByTestId('user-document-library-document-upload-provider-select');

    fireEvent.mouseDown(select);

    expect(await screen.findByText('(None)')).toBeInTheDocument();
    expect(await screen.findByText('Provider 1')).toBeInTheDocument();
    expect(await screen.findByText('Provider 2')).toBeInTheDocument();
  });

  it('calls updateSystemConfig when a new option is selected', async () => {
    render(
      <table>
        <tbody>
          <DocumentLibraryDocumentUploadProviderConfigRow documentUploadProviderId={null} />
        </tbody>
      </table>
    );

    const select = screen.getByTestId('user-document-library-document-upload-provider-select');

    fireEvent.mouseDown(select);

    const option = await screen.findByText('Provider 1');
    fireEvent.mouseDown(option);

    await waitFor(() => {
      expect(mockUpdateSystemConfig).toHaveBeenCalled();
    });

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith({
      configField: 'documentLibraryDocumentUploadProviderId',
      configValue: '1',
    });
  });

  it('selects the correct option when documentLibraryDocumentUploadProviderId is provided', async () => {
    render(
      <table>
        <tbody>
          <DocumentLibraryDocumentUploadProviderConfigRow documentUploadProviderId='2' />
        </tbody>
      </table>
    );

    const select = screen.getByTestId('user-document-library-document-upload-provider-select');

    expect(select).toHaveValue('Provider 2');

    fireEvent.mouseDown(select);

    const selectedOption = await screen.findByRole('option', {
      selected: true,
    });
    expect(selectedOption).toHaveTextContent('Provider 2');

    const noneOption = await screen.findByText('(None)');
    expect(noneOption).toBeInTheDocument();

    const provider1Option = await screen.findByText('Provider 1');
    expect(provider1Option).toBeInTheDocument();
  });

  it('displays success notification on successful update', async () => {
    mockUpdateSystemConfig.mockResolvedValueOnce({});

    render(
      <table>
        <tbody>
          <DocumentLibraryDocumentUploadProviderConfigRow documentUploadProviderId={null} />
        </tbody>
      </table>
    );

    const select = screen.getByTestId('user-document-library-document-upload-provider-select');

    fireEvent.mouseDown(select);

    const option = await screen.findByText('Provider 1');
    fireEvent.mouseDown(option);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Document Library Document Upload Provider Updated',
        message: 'Document Library Document Upload Provider has been updated.',
        icon: <IconCheck />,
        variant: 'successful_operation',
      }));
    });
  });

  it('displays failure notification on failed update', async () => {
    const errorMessage = 'Failed to update';
    mockUpdateSystemConfig.mockRejectedValueOnce(new Error(errorMessage));

    render(
      <table>
        <tbody>
          <DocumentLibraryDocumentUploadProviderConfigRow documentUploadProviderId={null} />
        </tbody>
      </table>
    );

    const select = screen.getByTestId('user-document-library-document-upload-provider-select');

    fireEvent.mouseDown(select);

    const option = await screen.findByText('Provider 1');
    fireEvent.mouseDown(option);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Failed to Update',
        message: errorMessage,
        icon: <IconX />,
        variant: 'failed_operation',
      }));
    });
  });

  it('calls updateSystemConfig with null when (None) is selected', async () => {
    render(
      <table>
        <tbody>
          <DocumentLibraryDocumentUploadProviderConfigRow documentUploadProviderId='2' />
        </tbody>
      </table>
    );

    const select = screen.getByTestId('user-document-library-document-upload-provider-select');

    fireEvent.mouseDown(select);

    const noneOption = await screen.findByText('(None)');
    fireEvent.mouseDown(noneOption);

    await waitFor(() => {
      expect(mockUpdateSystemConfig).toHaveBeenCalled();
    });

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith({
      configField: SystemConfigFields.DocumentLibraryDocumentUploadProviderId,
      configValue: null,
    });
  });
});
