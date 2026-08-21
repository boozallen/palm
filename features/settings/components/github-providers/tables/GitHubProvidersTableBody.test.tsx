import { render, screen } from '@testing-library/react';
import { JSX } from 'react';
import GitHubProvidersTableBody from './GitHubProvidersTableBody';

jest.mock('./GitHubProviderRow', () => {
  return jest.fn(() => (
    <tr data-testid='github-provider-row'>
      <td>GitHub Provider Row</td>
    </tr>
  ));
});

function TableWrapper({ children }: Readonly<{ children: JSX.Element }>) {
  return <table>{children}</table>;
}

describe('GitHubProvidersTableBody', () => {
  const mockProviders = [
    {
      id: 'provider-uuid-1',
      label: 'Provider One',
      apiBaseUrl: 'https://api.github.com',
      owner: 'myorg',
      repo: 'my-repo',
      description: 'First provider',
      isSkillRepo: false,
      skillRepoBranch: null,
      skillRepoServiceUrl: null,
      skillRepoLastSyncAt: null,
      skillRepoLastSyncCommit: null,
    },
    {
      id: 'provider-uuid-2',
      label: 'Provider Two',
      apiBaseUrl: 'https://github.enterprise.com/api/v3',
      owner: 'otherorg',
      repo: 'other-repo',
      description: 'Second provider',
      isSkillRepo: false,
      skillRepoBranch: null,
      skillRepoServiceUrl: null,
      skillRepoLastSyncAt: null,
      skillRepoLastSyncCommit: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a row for each GitHub provider', () => {
    render(
      <TableWrapper>
        <GitHubProvidersTableBody githubProviders={mockProviders} />
      </TableWrapper>,
    );

    const rows = screen.getAllByTestId('github-provider-row');
    expect(rows.length).toBe(mockProviders.length);
  });

  it('renders no rows when the list is empty', () => {
    render(
      <TableWrapper>
        <GitHubProvidersTableBody githubProviders={[]} />
      </TableWrapper>,
    );

    expect(screen.queryByTestId('github-provider-row')).not.toBeInTheDocument();
  });
});
