import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import UserGroupGraphDatabasesTable from './UserGroupGraphDatabasesTable';
import { UserRole } from '@/features/shared/types/user';
import useGetUserGroup from '@/features/settings/api/user-groups/get-user-group';

jest.mock('./UserGroupGraphDatabasesTableHead', () => {
  return function MockedUserGroupGraphDatabasesTableHead() {
    return (
      <thead data-testid='mocked-table-head'>
        <tr><th>Table Head</th></tr>
      </thead>
    );
  };
});

jest.mock('./UserGroupGraphDatabasesTableBody', () => {
  return function MockedUserGroupGraphDatabasesTableBody({ 
    userGroupId, 
    graphDatabaseEnabled, 
    isAdmin,
  }: { 
    userGroupId: string; 
    graphDatabaseEnabled: boolean; 
    isAdmin: boolean 
  }) {
    return (
      <tbody data-testid='mocked-table-body'>
        <tr>
          <td>{userGroupId}</td>
          <td>{graphDatabaseEnabled ? 'enabled' : 'disabled'}</td>
          <td>{isAdmin ? 'admin' : 'user'}</td>
        </tr>
      </tbody>
    );
  };
});

jest.mock('@/features/settings/api/user-groups/get-user-group');

function TestWrapper({ children, userRole }: { children: React.ReactNode; userRole: UserRole }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const session = {
    expires: '1',
    user: {
      role: userRole,
      id: 'test-user-id',
    },
  };

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider session={session}>
        {children}
      </SessionProvider>
    </QueryClientProvider>
  );
}

describe('UserGroupGraphDatabasesTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    (useGetUserGroup as jest.Mock).mockReturnValue({
      data: {
        id: 'test-group-id',
        name: 'Test Group',
        graphDatabaseEnabled: false,
      },
      isPending: false,
      error: null,
    });
  });

  test('renders loading state', () => {
    (useGetUserGroup as jest.Mock).mockReturnValue({
      data: undefined,
      isPending: true,
      error: null,
    });

    render(
      <TestWrapper userRole={UserRole.Admin}>
        <UserGroupGraphDatabasesTable id='test-group-id' />
      </TestWrapper>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('renders error state', () => {
    const errorMessage = 'Failed to fetch user group';
    (useGetUserGroup as jest.Mock).mockReturnValue({
      data: undefined,
      isPending: false,
      error: { message: errorMessage },
    });

    render(
      <TestWrapper userRole={UserRole.Admin}>
        <UserGroupGraphDatabasesTable id='test-group-id' />
      </TestWrapper>
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  test('renders table for admin user with graph database enabled', () => {
    (useGetUserGroup as jest.Mock).mockReturnValue({
      data: {
        id: 'test-group-id',
        name: 'Test Group',
        graphDatabaseEnabled: true,
      },
      isPending: false,
      error: null,
    });

    render(
      <TestWrapper userRole={UserRole.Admin}>
        <UserGroupGraphDatabasesTable id='test-group-id' />
      </TestWrapper>
    );

    expect(screen.getByTestId('user-group-graph-database-table')).toBeInTheDocument();
    expect(screen.getByTestId('mocked-table-head')).toBeInTheDocument();
    expect(screen.getByTestId('mocked-table-body')).toBeInTheDocument();
    expect(screen.getByText('Table Head')).toBeInTheDocument();
    expect(screen.getByText('enabled')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  test('renders table for non-admin user with graph database disabled', () => {
    (useGetUserGroup as jest.Mock).mockReturnValue({
      data: {
        id: 'test-group-id',
        name: 'Test Group',
        graphDatabaseEnabled: false,
      },
      isPending: false,
      error: null,
    });

    render(
      <TestWrapper userRole={UserRole.User}>
        <UserGroupGraphDatabasesTable id='test-group-id' />
      </TestWrapper>
    );

    expect(screen.getByTestId('user-group-graph-database-table')).toBeInTheDocument();
    expect(screen.getByText('Table Head')).toBeInTheDocument();
    expect(screen.getByText('disabled')).toBeInTheDocument();
    expect(screen.getByText('user')).toBeInTheDocument();
  });

  test('passes correct userGroupId to table body', () => {
    (useGetUserGroup as jest.Mock).mockReturnValue({
      data: {
        id: 'specific-group-123',
        name: 'Specific Group',
        graphDatabaseEnabled: true,
      },
      isPending: false,
      error: null,
    });

    render(
      <TestWrapper userRole={UserRole.Admin}>
        <UserGroupGraphDatabasesTable id='specific-group-123' />
      </TestWrapper>
    );

    expect(screen.getByText('specific-group-123')).toBeInTheDocument();
  });
});
