import { render, screen, waitFor } from '@testing-library/react';
import UserGroupAiProvidersTable from './UserGroupAiProvidersTable';
import useGetAiProviders from '@/features/settings/api/get-ai-providers';

jest.mock('@/features/settings/api/update-user-group-ai-providers');

jest.mock('@/features/settings/api/get-ai-providers', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: {
      aiProviders: [
        {
          id: '1',
          createdAt: 'date',
          updatedAt: 'date',
          label: 'Open Ai Provider',
        },
        {
          id: '2',
          createdAt: 'date',
          updatedAt: 'date',
          label: 'Anthropic Ai Provider',
        },
      ],
    },
    isPending: false,
    error: null,
  })),
}));

jest.mock('@/features/settings/api/get-user-group-ai-providers', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: {
      userGroupProviders: [
        { id: '1', createdAt: 'date1', updatedAt: 'date1', label: 'Open Ai Provider' },
        { id: '2', createdAt: 'date2', updatedAt: 'date2', label: 'Anthropic Ai Provider' },
      ],
    },
    isPending: false,
    error: null,
  })),
}));

const mockUserGroupId = 'testid';

describe('UserGroupAiProvidersTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<UserGroupAiProvidersTable id={mockUserGroupId} />);
    const table = screen.getByTestId('user-group-ai-providers-table');
    expect(table).toBeInTheDocument();
  });

  it('does not render table if data is pending', () => {
    (useGetAiProviders as jest.Mock).mockReturnValueOnce({
      data: [],
      isPending: true,
      error: null,
    });

    render(<UserGroupAiProvidersTable id={mockUserGroupId} />);

    const table = screen.queryByTestId('user-group-ai-providers-table');
    const loading = screen.queryByText('Loading...');

    expect(table).not.toBeInTheDocument();
    expect(loading).toBeInTheDocument();
  });

  it('renders error message if there is a problem fetching data', () => {
    (useGetAiProviders as jest.Mock).mockReturnValueOnce({
      data: [],
      isPending: false,
      error: new Error('Error fetching data'),
    });

    render(<UserGroupAiProvidersTable id={mockUserGroupId} />);

    const table = screen.queryByTestId('user-group-ai-providers-table');
    const error = screen.queryByText('Error fetching data');

    expect(table).not.toBeInTheDocument();
    expect(error).toBeInTheDocument();
  });

  it('renders AI provider table with data', async () => {
    render(<UserGroupAiProvidersTable id={mockUserGroupId} />);

    await waitFor(() => {
      expect(screen.getByText('Open Ai Provider')).toBeInTheDocument();
      expect(screen.getByText('Anthropic Ai Provider')).toBeInTheDocument();

    });
  });
});
