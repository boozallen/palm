import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useUpdateUserGroupGraphDatabase from '@/features/settings/api/user-groups/update-user-group-graph-database';
import UserGroupGraphDatabaseRow from './UserGroupGraphDatabaseRow';

jest.mock('@/features/settings/api/user-groups/update-user-group-graph-database');
jest.mock('@mantine/notifications');

const updateUserGroupGraphDatabase = jest.fn();

type UserGroupGraphDatabaseRowProps = Readonly<{
  userGroupId: string;
  isEnabled: boolean;
  isAdmin: boolean;
}>;

const TableBodyWrapper = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <table>
    <tbody>
      {children}
    </tbody>
  </table>
);

const renderComponent = (props: UserGroupGraphDatabaseRowProps) => {
  render(
    <TableBodyWrapper>
      <UserGroupGraphDatabaseRow {...props} />
    </TableBodyWrapper>
  );
};

describe('UserGroupGraphDatabaseRow', () => {
  let mockUserGroupId: string;
  let mockIsEnabled: boolean;
  let mockIsAdmin: boolean;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUserGroupId = 'test-group-id';
    mockIsEnabled = false;
    mockIsAdmin = true;

    (useUpdateUserGroupGraphDatabase as jest.Mock).mockReturnValue({
      mutateAsync: updateUserGroupGraphDatabase,
      isPending: false,
      error: null,
    });
  });

  it('renders the graph database row as enabled for admin', () => {
    mockIsEnabled = true;
    mockIsAdmin = true;
    renderComponent({ userGroupId: mockUserGroupId, isEnabled: mockIsEnabled, isAdmin: mockIsAdmin });

    const row = screen.getByTestId('user-group-graph-database-row');
    expect(row).toBeInTheDocument();

    expect(screen.getByText('Neo4j')).toBeInTheDocument();

    const switchComponent = screen.getByRole('switch');
    expect(switchComponent).toBeInTheDocument();
    expect(switchComponent).toBeChecked();
  });

  it('renders the graph database row as disabled for non-admin', () => {
    mockIsAdmin = false;
    renderComponent({ userGroupId: mockUserGroupId, isEnabled: mockIsEnabled, isAdmin: mockIsAdmin });

    const row = screen.getByTestId('user-group-graph-database-row');
    expect(row).toBeInTheDocument();

    expect(screen.getByText('Neo4j')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    const switchComponent = screen.getByRole('switch');
    expect(switchComponent).toBeInTheDocument();
    expect(switchComponent).not.toBeChecked();
  });

  it('calls updateUserGroupGraphDatabase when toggling a Switch', async () => {
    renderComponent({ userGroupId: mockUserGroupId, isEnabled: mockIsEnabled, isAdmin: mockIsAdmin });

    const switchComponent = screen.getByRole('switch');
    expect(switchComponent).toBeInTheDocument();
    expect(switchComponent).not.toBeChecked();

    fireEvent.click(switchComponent);

    await waitFor(() => {
      expect(updateUserGroupGraphDatabase).toBeCalledWith({ 
        userGroupId: mockUserGroupId, 
        graphDatabaseEnabled: !mockIsEnabled,
      });
      expect(notifications.show).not.toHaveBeenCalled();
    });
  });

  it('shows a notification toast if updateUserGroupGraphDatabase fails', async () => {
    const mockError = new Error('Failed to update user group graph database');
    (useUpdateUserGroupGraphDatabase as jest.Mock).mockReturnValue({
      mutateAsync: updateUserGroupGraphDatabase,
      isPending: false,
      error: mockError,
    });
    updateUserGroupGraphDatabase.mockRejectedValue(mockError);

    renderComponent({ userGroupId: mockUserGroupId, isEnabled: mockIsEnabled, isAdmin: mockIsAdmin });

    const switchComponent = screen.getByRole('switch');
    fireEvent.click(switchComponent);

    await waitFor(() => {
      expect(updateUserGroupGraphDatabase).toBeCalledWith({ 
        userGroupId: mockUserGroupId, 
        graphDatabaseEnabled: !mockIsEnabled,
      });
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'update-user-group-graph-database-failed',
        title: 'Failed to Update',
        message: mockError.message,
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    });
  });
});
