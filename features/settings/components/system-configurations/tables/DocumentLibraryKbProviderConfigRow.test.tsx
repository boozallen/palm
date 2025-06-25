import { render, screen, waitFor } from '@testing-library/react';
import DocumentLibraryKbProviderConfigRow from './DocumentLibraryKbProviderConfigRow';
import getKbProviders from '@/features/settings/api/get-kb-providers';
import { useUpdateSystemConfig } from '@/features/settings/api/update-system-config';
import userEvent from '@testing-library/user-event';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import { SystemConfigFields } from '@/features/shared/types';

jest.mock('@/features/settings/api/get-kb-providers');
jest.mock('@/features/settings/api/update-system-config');
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

describe('DocumentLibraryKbProviderConfigRow', () => {
  const mockUpdateSystemConfig = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (getKbProviders as jest.Mock).mockReturnValue({
      data: {
        kbProviders: [
          { id: '1', label: 'Provider 1', writeAccess: true },
          { id: '2', label: 'Provider 2', writeAccess: true },
          { id: '3', label: 'Provider 3', writeAccess: false },
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
          <DocumentLibraryKbProviderConfigRow documentLibraryKbProviderId={null} />
        </tbody>
      </table>
    );

    const row = screen.getByTestId('document-library-kb-provider-config-row');
    expect(row).toBeInTheDocument();
  });

  it('renders loading state', () => {
    (getKbProviders as jest.Mock).mockReturnValueOnce({
      data: null,
      isPending: true,
      error: null,
    });

    render(
      <table>
        <tbody>
          <DocumentLibraryKbProviderConfigRow documentLibraryKbProviderId={null} />
        </tbody>
      </table>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders error state', () => {
    (getKbProviders as jest.Mock).mockReturnValueOnce({
      data: null,
      isPending: false,
      error: { message: 'Error fetching providers' },
    });

    render(
      <table>
        <tbody>
          <DocumentLibraryKbProviderConfigRow documentLibraryKbProviderId={null} />
        </tbody>
      </table>
    );

    expect(screen.getByText('Error fetching providers')).toBeInTheDocument();
  });

  it('renders Select with correct options', async () => {
    const user = userEvent.setup();

    render(
      <table>
        <tbody>
          <DocumentLibraryKbProviderConfigRow documentLibraryKbProviderId={null} />
        </tbody>
      </table>
    );

    const select = screen.getByTestId('user-document-library-kb-provider-select');

    await user.click(select);

    expect(await screen.findByText('(None)')).toBeInTheDocument();
    expect(await screen.findByText('Provider 1')).toBeInTheDocument();
    expect(await screen.findByText('Provider 2')).toBeInTheDocument();
    expect(screen.queryByText('Provider 3')).not.toBeInTheDocument();
  });

  it('calls updateSystemConfig when a new option is selected', async () => {
    const user = userEvent.setup();

    render(
      <table>
        <tbody>
          <DocumentLibraryKbProviderConfigRow documentLibraryKbProviderId={null} />
        </tbody>
      </table>
    );

    const select = screen.getByTestId('user-document-library-kb-provider-select');

    await user.click(select);

    const option = await screen.findByText('Provider 1');
    await user.click(option);

    await waitFor(() => {
      expect(mockUpdateSystemConfig).toHaveBeenCalled();
    });

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith({
      configField: 'documentLibraryKbProviderId',
      configValue: '1',
    });
  });

  it('selects the correct option when documentLibraryKbProviderId is provided', async () => {
    render(
      <table>
        <tbody>
          <DocumentLibraryKbProviderConfigRow documentLibraryKbProviderId='2' />
        </tbody>
      </table>
    );

    const select = screen.getByTestId('user-document-library-kb-provider-select');

    expect(select).toHaveValue('Provider 2');

    const user = userEvent.setup();
    await user.click(select);

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
    const user = userEvent.setup();
    mockUpdateSystemConfig.mockResolvedValueOnce({});

    render(
      <table>
        <tbody>
          <DocumentLibraryKbProviderConfigRow documentLibraryKbProviderId={null} />
        </tbody>
      </table>
    );

    const select = screen.getByTestId('user-document-library-kb-provider-select');

    await user.click(select);

    const option = await screen.findByText('Provider 1');
    await user.click(option);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Document Library Knowledge Base Provider Updated',
        message: 'Document Library knowledge base provider has been updated.',
        icon: <IconCheck />,
        variant: 'successful_operation',
      }));
    });
  });

  it('displays failure notification on failed update', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Failed to update';
    mockUpdateSystemConfig.mockRejectedValueOnce(new Error(errorMessage));

    render(
      <table>
        <tbody>
          <DocumentLibraryKbProviderConfigRow documentLibraryKbProviderId={null} />
        </tbody>
      </table>
    );

    const select = screen.getByTestId('user-document-library-kb-provider-select');

    await user.click(select);

    const option = await screen.findByText('Provider 1');
    await user.click(option);

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
    const user = userEvent.setup();

    render(
      <table>
        <tbody>
          <DocumentLibraryKbProviderConfigRow documentLibraryKbProviderId='2' />
        </tbody>
      </table>
    );

    const select = screen.getByTestId('user-document-library-kb-provider-select');

    await user.click(select);

    const noneOption = await screen.findByText('(None)');
    await user.click(noneOption);

    await waitFor(() => {
      expect(mockUpdateSystemConfig).toHaveBeenCalled();
    });

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith({
      configField: SystemConfigFields.DocumentLibraryKbProviderId,
      configValue: null,
    });
  });
});
