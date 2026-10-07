import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import UserGroupKbProvidersTable from './UserGroupKbProvidersTable';
import useGetKbProviders from '@/features/settings/api/kb-providers/get-kb-providers';
import useGetUserGroupKbProviders from '@/features/settings/api/user-groups/get-user-group-kb-providers';
import { KbProviderType } from '@/features/shared/types';
import { ITEMS_PER_PAGE } from '@/features/shared/utils';

jest.mock('@/features/settings/components/user-groups/tables/UserGroupKbProviderRow.tsx', () => {
  return function UserGroupKbProviderRow() {
    return <tr><td>Mock KB Provider Row</td></tr>;
  };
});

jest.mock('@/features/settings/api/kb-providers/get-kb-providers');
jest.mock('@/features/settings/api/user-groups/get-user-group-kb-providers');

describe('UserGroupKbProvidersTable', () => {

  const mockId = '60c410be-11b0-4b78-ad85-dceeeb0701cd';

  const mockKbProviders = {
    kbProviders: [{
      id: '10e0eba0-b782-491b-b609-b5c84cb0e171',
      label: 'mockLabel 1',
      kbProviderType: KbProviderType.KbProviderPalm,
      config: { apiEndpoint: 'https://www.endpoint.com' },
      createdAt: new Date('2024-02-02T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    },
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e172',
      label: 'mockLabel 2',
      kbProviderType: KbProviderType.KbProviderPalm,
      config: { apiEndpoint: 'https://www.endpoint.com' },
      createdAt: new Date('2024-02-02T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    },
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e173',
      label: 'mockLabel 3',
      kbProviderType: KbProviderType.KbProviderPalm,
      config: { apiEndpoint: 'https://www.endpoint.com' },
      createdAt: new Date('2024-02-02T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    },
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e174',
      label: 'mockLabel 4',
      kbProviderType: KbProviderType.KbProviderPalm,
      config: { apiEndpoint: 'https://www.endpoint.com' },
      createdAt: new Date('2024-02-02T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    },
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e175',
      label: 'mockLabel 5',
      kbProviderType: KbProviderType.KbProviderPalm,
      config: { apiEndpoint: 'https://www.endpoint.com' },
      createdAt: new Date('2024-02-02T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    },
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e176',
      label: 'mockLabel 6',
      kbProviderType: KbProviderType.KbProviderPalm,
      config: { apiEndpoint: 'https://www.endpoint.com' },
      createdAt: new Date('2024-02-02T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    },
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e1717',
      label: 'mockLabel 7',
      kbProviderType: KbProviderType.KbProviderPalm,
      config: { apiEndpoint: 'https://www.endpoint.com' },
      createdAt: new Date('2024-02-02T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    },
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e178',
      label: 'mockLabel 8',
      kbProviderType: KbProviderType.KbProviderPalm,
      config: { apiEndpoint: 'https://www.endpoint.com' },
      createdAt: new Date('2024-02-02T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    },
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e179',
      label: 'mockLabel 9',
      kbProviderType: KbProviderType.KbProviderPalm,
      config: { apiEndpoint: 'https://www.endpoint.com' },
      createdAt: new Date('2024-02-02T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    },
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e180',
      label: 'mockLabel 10',
      kbProviderType: KbProviderType.KbProviderPalm,
      config: { model: 'mock Model' },
      createdAt: new Date('2024-02-02T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    },
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e111',
      label: 'mockLabel 11',
      kbProviderType: KbProviderType.KbProviderPalm,
      config: { model: 'mock Model' },
      createdAt: new Date('2024-02-02T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    }],
  };

  const mockUserGroupKbProviders = {
    userGroupKbProviders: [
      {
        id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
      },
      {
        id: '10e0eba0-b782-491b-b609-b5c84cb0e17b',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetKbProviders as jest.Mock).mockReturnValue({
      data: mockKbProviders,
      isPending: false,
      error: null,
    });

    (useGetUserGroupKbProviders as jest.Mock).mockReturnValue({
      data: mockUserGroupKbProviders,
      isPending: false,
      error: null,
    });

    render(<UserGroupKbProvidersTable id={mockId} />);
  });

  it('renders table headers', () => {
    const providerHeader = screen.getByText('Provider');
    const enabledHeader = screen.getByText('Enabled');

    expect(providerHeader).toBeInTheDocument();
    expect(enabledHeader).toBeInTheDocument();
  });

  it('displays a message if there are no KB Providers', () => {
    (useGetKbProviders as jest.Mock).mockReturnValue({
      data: { kbProviders: [] },
      isPending: false,
      error: null,
    });

    render(<UserGroupKbProvidersTable id={mockId} />);

    const error = screen.getByText('No knowledge base providers have been configured yet.');
    expect(error).toBeInTheDocument();
  });

  it('displays correct number of KB Provider rows for the first page', () => {
    const providerRows = screen.getAllByText('Mock KB Provider Row');

    expect(providerRows).toHaveLength(10);
  });

  it('displays pagination component when KB Providers exceed 10 rows', () => {
    const pagination = screen.getByTestId('kb-providers-table-pagination');

    expect(pagination).toBeInTheDocument();
  });

  it('successfully goes to next page and displays correct number of rows', async () => {
    const buttons = screen.getAllByRole('button');

    const nextPageButton = buttons[buttons.length - 1];

    fireEvent.click(nextPageButton);

    await waitFor(() => {
      const providerRows = screen.getAllByText('Mock KB Provider Row');

      expect(providerRows).toHaveLength(mockKbProviders.kbProviders.length - ITEMS_PER_PAGE);
    });
  });

});

