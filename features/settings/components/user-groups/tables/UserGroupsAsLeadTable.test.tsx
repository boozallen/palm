import { render, screen } from '@testing-library/react';
import UserGroupsAsLeadTable from './UserGroupsAsLeadTable';
import useGetUserGroupsAsLead from '@/features/settings/api/user-groups/get-user-groups-as-lead';

jest.mock('@/features/settings/api/user-groups/get-user-groups-as-lead');

describe('UserGroupsAsLeadTable', () => {

  const mockUserGroupsAsLead = {
    userGroupsAsLead: [
      {
        id: 'test-user-group-1',
        label: 'User Group 1',
        memberCount: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'test-user-group-2',
        label: 'User Group 2',
        memberCount: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    (useGetUserGroupsAsLead as jest.Mock).mockReturnValueOnce({
      data: mockUserGroupsAsLead,
      isPending: false,
      error: null,
    });

    render(<UserGroupsAsLeadTable />);

    const table = screen.getByTestId('user-groups-as-lead-table');
    const tableHead = screen.getByTestId('user-groups-as-lead-table-head');
    const tableBody = screen.getByTestId('user-groups-as-lead-table-body');

    expect(table).toBeInTheDocument();
    expect(tableHead).toBeInTheDocument();
    expect(tableBody).toBeInTheDocument();
  });

  it('does not render table if data is pending', () => {
    (useGetUserGroupsAsLead as jest.Mock).mockReturnValueOnce({
      data: { userGroupsAsLead: [] },
      isPending: true,
      error: null,
    });

    render(<UserGroupsAsLeadTable />);

    const table = screen.queryByTestId('user-groups-as-lead-table');
    const tableHead = screen.queryByTestId('user-groups-as-lead-table-head');
    const tableBody = screen.queryByTestId('user-groups-as-lead-table-body');
    const loading = screen.getByText('Loading...');

    expect(table).not.toBeInTheDocument();
    expect(tableHead).not.toBeInTheDocument();
    expect(tableBody).not.toBeInTheDocument();
    expect(loading).toBeInTheDocument();
  });

  it('renders an error message if there is a problem fetching data', () => {
    (useGetUserGroupsAsLead as jest.Mock).mockReturnValueOnce({
      data: { userGroupsAsLead: [] },
      isPending: false,
      error: new Error('Error fetching data'),
    });

    render(<UserGroupsAsLeadTable />);

    const table = screen.queryByTestId('user-groups-as-lead-table');
    const tableHead = screen.queryByTestId('user-groups-as-lead-table-head');
    const tableBody = screen.queryByTestId('user-groups-as-lead-table-body');
    const error = screen.getByText('Error fetching data');

    expect(table).not.toBeInTheDocument();
    expect(tableHead).not.toBeInTheDocument();
    expect(tableBody).not.toBeInTheDocument();
    expect(error).toBeInTheDocument();
  });

  it('renders a message if there are no user groups', () => {
    (useGetUserGroupsAsLead as jest.Mock).mockReturnValueOnce({
      data: { userGroupsAsLead: [] },
      isPending: false,
      error: null,
    });

    render(<UserGroupsAsLeadTable />);

    const table = screen.queryByTestId('user-groups-as-lead-table');
    const tableHead = screen.queryByTestId('user-groups-as-lead-table-head');
    const tableBody = screen.queryByTestId('user-groups-as-lead-table-body');
    const message = screen.getByText('You are not a lead of any user group.');

    expect(table).not.toBeInTheDocument();
    expect(tableHead).not.toBeInTheDocument();
    expect(tableBody).not.toBeInTheDocument();
    expect(message).toBeInTheDocument();
  });

});
