import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import UserGroupsUserFilter from './UserGroupsUserFilter';
import useGetUsersListWithRole from '@/features/settings/api/admins/get-users-list-with-role';
import { UserRole } from '@/features/shared/types/user';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@/features/settings/api/admins/get-users-list-with-role');

const mockUser = {
  id: '50fa3ce5-bcc0-478c-aebf-c3627875e13d',
  name: 'Miller, Mac',
  email: 'mac@gmail.com',
  role: UserRole.User,
};

describe('UserGroupsUserFilter', () => {
  const onSelectedUserChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetUsersListWithRole as jest.Mock).mockReturnValue({
      data: { users: [mockUser] },
      isPending: false,
      error: undefined,
    });
  });

  it('renders a searchable user select', () => {
    render(
      <UserGroupsUserFilter
        selectedUser={null}
        onSelectedUserChange={onSelectedUserChange}
      />
    );

    const userSelect = screen.getByTestId('user-groups-user-filter');

    expect(userSelect).toBeInTheDocument();
    expect(userSelect).toHaveAttribute(
      'placeholder',
      'Search by name or email'
    );
  });

  it('reports the picked user to its parent', async () => {
    render(
      <UserGroupsUserFilter
        selectedUser={null}
        onSelectedUserChange={onSelectedUserChange}
      />
    );

    const userSelect = screen.getByTestId('user-groups-user-filter');

    userSelect.click();
    fireEvent.change(userSelect, { target: { value: 'Miller' } });
    fireEvent.keyDown(userSelect, { key: 'ArrowDown' });
    fireEvent.keyDown(userSelect, { key: 'Enter' });

    await waitFor(() => {
      expect(onSelectedUserChange).toHaveBeenCalledWith({
        id: mockUser.id,
        name: mockUser.name,
      });
    });
  });

  it('reports null to its parent when the selection is cleared', async () => {
    render(
      <UserGroupsUserFilter
        selectedUser={{ id: mockUser.id, name: mockUser.name }}
        onSelectedUserChange={onSelectedUserChange}
      />
    );

    const clearButton = screen.getByLabelText('Clear selected user');

    clearButton.click();

    await waitFor(() => {
      expect(onSelectedUserChange).toHaveBeenCalledWith(null);
    });
  });

  it('renders an error message when the user search fails', () => {
    (useGetUsersListWithRole as jest.Mock).mockReturnValue({
      data: undefined,
      isPending: false,
      error: new Error('Error getting users'),
    });

    render(
      <UserGroupsUserFilter
        selectedUser={null}
        onSelectedUserChange={onSelectedUserChange}
      />
    );

    expect(
      screen.queryByTestId('user-groups-user-filter')
    ).not.toBeInTheDocument();
    expect(screen.getByText('Error getting users')).toBeInTheDocument();
  });
});
