import { render } from '@testing-library/react';
import GitHubProvidersTable from './GitHubProvidersTable';
import useGetGitHubProviders from '@/features/settings/api/github-providers/get-github-providers';

jest.mock('@/features/settings/api/github-providers/get-github-providers');

jest.mock('./GitHubProvidersTableBody', () => {
  return function MockedGitHubProvidersTableBody() {
    return <tbody data-testid='github-providers-table-body'></tbody>;
  };
});

describe('GitHubProvidersTable', () => {
  let getGitHubProvidersMockReturn: {
    data: { githubProviders: { id: string; label: string; apiBaseUrl: string; description: string }[] } | undefined;
    isPending: boolean;
    error: Error | null;
  };

  const tableTestId = 'github-providers-table';

  beforeEach(() => {
    jest.clearAllMocks();

    getGitHubProvidersMockReturn = {
      data: { githubProviders: [] },
      isPending: false,
      error: null,
    };
  });

  it('renders without crashing', () => {
    (useGetGitHubProviders as jest.Mock).mockReturnValue(getGitHubProvidersMockReturn);
    const { container } = render(<GitHubProvidersTable />);
    expect(container).toBeTruthy();
  });

  it('shows empty state when there are no GitHub providers', () => {
    (useGetGitHubProviders as jest.Mock).mockReturnValue(getGitHubProvidersMockReturn);
    const { queryByTestId, queryByText } = render(<GitHubProvidersTable />);

    expect(queryByTestId(tableTestId)).not.toBeInTheDocument();
    expect(queryByText('No GitHub Providers have been configured yet.')).toBeInTheDocument();
  });

  it('renders the table when GitHub providers exist', () => {
    getGitHubProvidersMockReturn.data = {
      githubProviders: [
        {
          id: 'provider-uuid-1',
          label: 'My Provider',
          apiBaseUrl: 'https://api.github.com',
          description: 'A test provider',
        },
      ],
    };

    (useGetGitHubProviders as jest.Mock).mockReturnValue(getGitHubProvidersMockReturn);
    const { queryByTestId } = render(<GitHubProvidersTable />);

    expect(queryByTestId(tableTestId)).toBeInTheDocument();
  });

  it('renders loading state when pending', () => {
    getGitHubProvidersMockReturn.isPending = true;
    (useGetGitHubProviders as jest.Mock).mockReturnValue(getGitHubProvidersMockReturn);

    const { queryByText, queryByTestId } = render(<GitHubProvidersTable />);

    expect(queryByText('Loading...')).toBeInTheDocument();
    expect(queryByTestId(tableTestId)).not.toBeInTheDocument();
  });

  it('renders error message when there is an error', () => {
    getGitHubProvidersMockReturn.error = new Error('Error fetching GitHub providers');
    (useGetGitHubProviders as jest.Mock).mockReturnValue(getGitHubProvidersMockReturn);

    const { queryByText, queryByTestId } = render(<GitHubProvidersTable />);

    expect(queryByText('Error fetching GitHub providers')).toBeInTheDocument();
    expect(queryByTestId(tableTestId)).not.toBeInTheDocument();
  });
});
