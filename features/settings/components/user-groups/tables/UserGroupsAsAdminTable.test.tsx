import { render, screen } from '@testing-library/react';
import UserGroupsAsAdminTable from './UserGroupsAsAdminTable';
import useGetUserGroups from '@/features/settings/api/user-groups/get-user-groups';

jest.mock('@/features/settings/components/user-groups/tables/UserGroupsAsAdminTableHead', () => {
  return function MockedUserGroupsAsAdminTableHead() {
    return <thead><tr><th>Mocked User Groups As Admin Table Head</th></tr></thead>;
  };
});

jest.mock('@/features/settings/components/user-groups/tables/UserGroupsAsAdminTableBody', () => {
  return function MockedUserGroupsAsAdminTableBody() {
    return <tbody><tr><td>Mocked User Groups As Admin Table Body</td></tr></tbody>;
  };
});

jest.mock('@/features/settings/api/user-groups/get-user-groups');

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
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    (useGetUserGroups as jest.Mock).mockReturnValueOnce({
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
    (useGetUserGroups as jest.Mock).mockReturnValueOnce({
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
    (useGetUserGroups as jest.Mock).mockReturnValueOnce({
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
    (useGetUserGroups as jest.Mock).mockReturnValueOnce({
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

});
