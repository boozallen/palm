import { render, screen } from '@testing-library/react';
import UserGroupsTable from './UserGroupsTable';
import useGetUserGroups from '@/features/profile/api/get-user-groups';

// Mock the modules
jest.mock('@/features/profile/api/get-user-groups');
// eslint-disable-next-line react/display-name
jest.mock('@/features/shared/components/Loading', () => () => <div>Loading...</div>);
// eslint-disable-next-line react/display-name
jest.mock('./UserGroupRow', () => ({ group }: { group: { id: string; name: string; role: string } }) => (
  <tr>
    <td>{group.name}</td>
    <td>{group.role}</td>
  </tr>
));

describe('UserGroupsTable', () => {
  it('shows loading component while data is pending', () => {
    (useGetUserGroups as jest.Mock).mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    });

    render(<UserGroupsTable />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error message when there is an error', () => {
    (useGetUserGroups as jest.Mock).mockReturnValue({
      data: null,
      isPending: false,
      error: { message: 'Error fetching user groups' },
    });

    render(<UserGroupsTable />);

    expect(screen.getByText('Error fetching user groups')).toBeInTheDocument();
  });

  it('shows no user groups message when user is not part of any group', () => {
    (useGetUserGroups as jest.Mock).mockReturnValue({
      data: { userGroups: [] },
      isPending: false,
      error: null,
    });

    render(<UserGroupsTable />);

    expect(screen.getByText('Not a member of any user groups.')).toBeInTheDocument();
  });

  it('renders user groups table when data is available', () => {
    const userGroups = {
      userGroups: [
        { id: '1', name: 'Admin Group', role: 'Admin' },
        { id: '2', name: 'User Group', role: 'User' },
      ],
    };

    (useGetUserGroups as jest.Mock).mockReturnValue({
      data: userGroups,
      isPending: false,
      error: null,
    });

    render(<UserGroupsTable />);

    // Check that table headers are present
    expect(screen.getByText('Group')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();

    // Check that UserGroupRow is rendered for each user group
    expect(screen.getByText('Admin Group')).toBeInTheDocument();
    expect(screen.getByText('User Group')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
  });
});

