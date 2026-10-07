import { fireEvent, render, screen } from '@testing-library/react';
import UserGroupsAsAdminTable from './UserGroupsAsAdminTable';
import useGetUserGroups from '@/features/settings/api/user-groups/get-user-groups';
import useGetUserGroupMembershipsByUser from '@/features/settings/api/user-groups/get-user-group-memberships-by-user';
import { UserGroup, UserGroupRole } from '@/features/shared/types/user-group';
import { SelectedUser } from '@/features/settings/types';

jest.mock('@/features/settings/components/user-groups/tables/UserGroupsAsAdminTableHead', () => {
  return function MockedUserGroupsAsAdminTableHead() {
    return <thead><tr><th>Mocked User Groups As Admin Table Head</th></tr></thead>;
  };
});

jest.mock('@/features/settings/components/user-groups/tables/UserGroupsAsAdminTableBody', () => {
  return function MockedUserGroupsAsAdminTableBody({
    userGroups,
    rolesByUserGroupId,
  }: Readonly<{
    userGroups: UserGroup[];
    rolesByUserGroupId?: Record<string, UserGroupRole>;
  }>) {
    return (
      <tbody>
        <tr><td>Mocked User Groups As Admin Table Body</td></tr>
        {userGroups.map((userGroup) => (
          <tr key={userGroup.id} data-testid={`${userGroup.id}-mocked-row`}>
            <td>{userGroup.label}</td>
            <td data-testid={`${userGroup.id}-mocked-role`}>
              {rolesByUserGroupId?.[userGroup.id] ?? ''}
            </td>
          </tr>
        ))}
      </tbody>
    );
  };
});

jest.mock('@/features/settings/components/user-groups/elements/UserGroupsUserFilter', () => {
  return function MockedUserGroupsUserFilter({
    onSelectedUserChange,
  }: Readonly<{
    onSelectedUserChange: (user: SelectedUser | null) => void;
  }>) {
    return (
      <button
        data-testid='mocked-select-user'
        onClick={() =>
          onSelectedUserChange({ id: 'user-1', name: 'Miller, Mac' })
        }
      >
        select user
      </button>
    );
  };
});

jest.mock('@/features/settings/api/user-groups/get-user-groups');
jest.mock('@/features/settings/api/user-groups/get-user-group-memberships-by-user');

describe('UserGroupsAsAdminTable', () => {

  const mockUserGroups = {
    userGroups: [
      {
        id: 'test-id-1',
        label: 'User Group 1',
        memberCount: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'test-id-2',
        label: 'User Group 2',
        memberCount: 8,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetUserGroupMembershipsByUser as jest.Mock).mockReturnValue({
      data: undefined,
      isPending: false,
      error: null,
    });
  });

  it('renders without crashing', () => {
    (useGetUserGroups as jest.Mock).mockReturnValue({
      data: mockUserGroups,
      isPending: false,
      error: null,
    });

    render(<UserGroupsAsAdminTable />);

    const table = screen.getByTestId('user-groups-as-admin-table');
    const tableHead = screen.getByText('Mocked User Groups As Admin Table Head');
    const tableBody = screen.getByText('Mocked User Groups As Admin Table Body');

    expect(table).toBeInTheDocument();
    expect(tableHead).toBeInTheDocument();
    expect(tableBody).toBeInTheDocument();
  });

  it('does not render table if data is pending', () => {
    (useGetUserGroups as jest.Mock).mockReturnValue({
      data: { userGroups: [] },
      isPending: true,
      error: null,
    });

    render(<UserGroupsAsAdminTable />);

    const table = screen.queryByTestId('user-groups-as-admin-table');
    const tableHead = screen.queryByText('Mocked User Groups As Admin Table Head');
    const tableBody = screen.queryByText('Mocked User Groups As Admin Table Body');
    const loading = screen.getByText('Loading...');

    expect(table).not.toBeInTheDocument();
    expect(tableHead).not.toBeInTheDocument();
    expect(tableBody).not.toBeInTheDocument();
    expect(loading).toBeInTheDocument();
  });

  it('renders error message if there is a problem fetching data', () => {
    (useGetUserGroups as jest.Mock).mockReturnValue({
      data: { userGroups: [] },
      isPending: false,
      error: new Error('Error fetching data'),
    });

    render(<UserGroupsAsAdminTable />);

    const table = screen.queryByTestId('user-groups-as-admin-table');
    const tableHead = screen.queryByText('Mocked User Groups As Admin Table Head');
    const tableBody = screen.queryByText('Mocked User Groups As Admin Table Body');
    const error = screen.getByText('Error fetching data');

    expect(table).not.toBeInTheDocument();
    expect(tableHead).not.toBeInTheDocument();
    expect(tableBody).not.toBeInTheDocument();
    expect(error).toBeInTheDocument();
  });

  it('renders a message if there are no user groups', () => {
    (useGetUserGroups as jest.Mock).mockReturnValue({
      data: { userGroups: [] },
      isPending: false,
      error: null,
    });

    render(<UserGroupsAsAdminTable />);

    const table = screen.queryByTestId('user-groups-as-admin-table');
    const tableHead = screen.queryByText('Mocked User Groups As Admin Table Head');
    const tableBody = screen.queryByText('Mocked User Groups As Admin Table Body');
    const message = screen.getByText('No user groups have been created yet.');

    expect(table).not.toBeInTheDocument();
    expect(tableHead).not.toBeInTheDocument();
    expect(tableBody).not.toBeInTheDocument();
    expect(message).toBeInTheDocument();
  });

  it('renders every group alongside the user filter when no user is selected', () => {
    (useGetUserGroups as jest.Mock).mockReturnValue({
      data: mockUserGroups,
      isPending: false,
      error: null,
    });

    render(<UserGroupsAsAdminTable />);

    expect(screen.getByTestId('mocked-select-user')).toBeInTheDocument();
    expect(screen.getByTestId('test-id-1-mocked-row')).toBeInTheDocument();
    expect(screen.getByTestId('test-id-2-mocked-row')).toBeInTheDocument();
  });

  it('shows only the groups the selected user belongs to, with their role', () => {
    (useGetUserGroups as jest.Mock).mockReturnValue({
      data: mockUserGroups,
      isPending: false,
      error: null,
    });
    (useGetUserGroupMembershipsByUser as jest.Mock).mockReturnValue({
      data: {
        memberships: [
          { userGroupId: 'test-id-2', role: UserGroupRole.Lead },
        ],
      },
      isPending: false,
      error: null,
    });

    render(<UserGroupsAsAdminTable />);

    fireEvent.click(screen.getByTestId('mocked-select-user'));

    expect(screen.queryByTestId('test-id-1-mocked-row')).not.toBeInTheDocument();
    expect(screen.getByTestId('test-id-2-mocked-row')).toBeInTheDocument();
    expect(screen.getByTestId('test-id-2-mocked-role')).toHaveTextContent(
      UserGroupRole.Lead
    );
  });

  it('keeps the user filter available when the selected user has no groups', () => {
    (useGetUserGroups as jest.Mock).mockReturnValue({
      data: mockUserGroups,
      isPending: false,
      error: null,
    });
    (useGetUserGroupMembershipsByUser as jest.Mock).mockReturnValue({
      data: { memberships: [] },
      isPending: false,
      error: null,
    });

    render(<UserGroupsAsAdminTable />);

    fireEvent.click(screen.getByTestId('mocked-select-user'));

    expect(screen.queryByTestId('user-groups-as-admin-table')).not.toBeInTheDocument();
    expect(screen.getByTestId('mocked-select-user')).toBeInTheDocument();
    expect(
      screen.getByText('Miller, Mac is not a member of any user group.')
    ).toBeInTheDocument();
  });

});
