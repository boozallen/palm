import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UserGroupGraphDatabasesTableBody from './UserGroupGraphDatabasesTableBody';

jest.mock('./UserGroupGraphDatabaseRow', () => {
  return function MockedUserGroupGraphDatabaseRow({ userGroupId, isEnabled, isAdmin }: {
    userGroupId: string;
    isEnabled: boolean;
    isAdmin: boolean;
  }) {
    return (
      <tr data-testid='mocked-user-group-graph-database-row'>
        <td>{userGroupId}</td>
        <td>{isEnabled ? 'enabled' : 'disabled'}</td>
        <td>{isAdmin ? 'admin' : 'user'}</td>
      </tr>
    );
  };
});

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <table>
        {children}
      </table>
    </QueryClientProvider>
  );
}

describe('UserGroupGraphDatabasesTableBody', () => {
  test('renders without crashing', () => {
    render(
      <TestWrapper>
        <UserGroupGraphDatabasesTableBody
          userGroupId='test-group-id'
          graphDatabaseEnabled={true}
          isAdmin={true}
        />
      </TestWrapper>
    );

    expect(screen.getByTestId('user-group-graph-databases-table-body')).toBeInTheDocument();
    expect(screen.getByTestId('mocked-user-group-graph-database-row')).toBeInTheDocument();
  });

  test('passes correct props to UserGroupGraphDatabaseRow', () => {
    render(
      <TestWrapper>
        <UserGroupGraphDatabasesTableBody
          userGroupId='test-group-123'
          graphDatabaseEnabled={false}
          isAdmin={false}
        />
      </TestWrapper>
    );

    expect(screen.getByText('test-group-123')).toBeInTheDocument();
    expect(screen.getByText('disabled')).toBeInTheDocument();
    expect(screen.getByText('user')).toBeInTheDocument();
  });

  test('passes enabled state correctly', () => {
    render(
      <TestWrapper>
        <UserGroupGraphDatabasesTableBody
          userGroupId='test-group-456'
          graphDatabaseEnabled={true}
          isAdmin={true}
        />
      </TestWrapper>
    );

    expect(screen.getByText('enabled')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });
});
