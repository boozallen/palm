import { render, screen } from '@testing-library/react';
import AzureAdScopesTable from './AzureAdScopesTable';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';

jest.mock('@/features/shared/api/get-system-config');

jest.mock('./AzureAdScopesConfigRow', () => {
  return function MockAzureAdScopesConfigRow({ currentScopes }: { currentScopes: string[] }) {
    return (
      <tr data-testid='azure-ad-scopes-config-row'>
        <td>{currentScopes.join(',')}</td>
      </tr>
    );
  };
});

describe('AzureAdScopesTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a loading state while system config is pending', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: undefined,
      isPending: true,
    });

    render(<AzureAdScopesTable />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByTestId('azure-ad-scopes-table')).not.toBeInTheDocument();
  });

  it('renders nothing when Azure AD is not an enabled auth provider', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: { azureAdEnabled: false, azureAdScopes: ['openid', 'profile', 'email'] },
      isPending: false,
    });

    const { container } = render(<AzureAdScopesTable />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the table and config row when Azure AD is enabled', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: { azureAdEnabled: true, azureAdScopes: ['openid', 'profile', 'email', 'offline_access'] },
      isPending: false,
    });

    render(<AzureAdScopesTable />);

    expect(screen.getByTestId('azure-ad-scopes-table')).toBeInTheDocument();
    expect(screen.getByText('Authentication - Azure AD')).toBeInTheDocument();
    expect(screen.getByTestId('azure-ad-scopes-config-row')).toHaveTextContent(
      'openid,profile,email,offline_access'
    );
  });

  it('defaults to the required scopes when azureAdScopes is missing but Azure AD is enabled', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: { azureAdEnabled: true, azureAdScopes: undefined },
      isPending: false,
    });

    render(<AzureAdScopesTable />);

    expect(screen.getByTestId('azure-ad-scopes-config-row')).toHaveTextContent('openid,profile,email');
  });
});
