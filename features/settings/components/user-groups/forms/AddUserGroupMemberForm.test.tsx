import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AddUserGroupMemberForm from './AddUserGroupMemberForm';
import useCreateUserGroupMembership from '@/features/settings/api/user-groups/create-user-group-membership';
import { UserGroupRole } from '@/features/shared/types/user-group';
import userEvent from '@testing-library/user-event';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useGetUsersListWithGroupMembershipStatus from '@/features/settings/api/user-groups/get-users-list-with-group-membership-status';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@mantine/notifications');

jest.mock('@/features/settings/api/user-groups/create-user-group-membership');
jest.mock('@/features/settings/api/user-groups/get-users-list-with-group-membership-status');

async function selectUser(query: string) {
  const userSelect = screen.getByLabelText('User');

  userSelect.click();

  await userEvent.type(userSelect, query);
  fireEvent.keyDown(userSelect, { key: 'ArrowDown' });
  fireEvent.keyDown(userSelect, { key: 'Enter' });

  return userSelect;
}

describe('AddUserGroupMemberForm', () => {
  const setFormCompleted = jest.fn();
  const createUserGroupMember = jest.fn();
  const userGroupId = '4b5685f5-88d1-4278-8f4a-f131e0c0668f';

  beforeEach(() => {
    (useCreateUserGroupMembership as jest.Mock).mockReturnValue({
      mutateAsync: createUserGroupMember,
      isPending: false,
      error: undefined,
    });

    (useGetUsersListWithGroupMembershipStatus as jest.Mock).mockReturnValue({
      data: {
        usersGroupMembershipStatus: [
          {
            id: '50fa3ce5-bcc0-478c-aebf-c3627875e13d',
            name: 'Miller, Mac',
            email: 'mac@gmail.com',
            isMember: false,
          },
        ],
      },
      isPending: false,
      error: undefined,
    });
  });

  it('renders correct form fields', () => {
    render(<AddUserGroupMemberForm setFormCompleted={setFormCompleted} id={userGroupId} />);
    const userSelect = screen.getByLabelText('User');
    const roleSelect = screen.getByLabelText('Role');

    expect(userSelect).toBeInTheDocument();
    expect(userSelect).toHaveAttribute('placeholder', 'Search by name or email');

    expect(roleSelect).toBeInTheDocument();
    expect(roleSelect).toHaveValue(UserGroupRole.User);
  });

  it('has a disabled submit button when form is not completed', () => {
    render(<AddUserGroupMemberForm setFormCompleted={setFormCompleted} id={userGroupId} />);
    const submitButton = screen.getByRole('button', { name: 'Add User' });

    expect(submitButton).toBeDisabled();
  });

  it('submits form with correct values', async () => {
    render(<AddUserGroupMemberForm setFormCompleted={setFormCompleted} id={userGroupId} />);

    const userSelect = await selectUser('Miller');

    expect(userSelect).toHaveValue('Miller, Mac (mac@gmail.com)');

    const submitButton = screen.getByRole('button', { name: 'Add User' });

    await act(async () => {
      submitButton.click();
    });

    await waitFor(() => {
      expect(createUserGroupMember).toHaveBeenCalledWith({
        userId: '50fa3ce5-bcc0-478c-aebf-c3627875e13d',
        role: UserGroupRole.User,
        userGroupId: userGroupId,
      });
    });
  });

  it('displays notification test if api call fails', async () => {
    const errorMessage = 'Error adding user to group';
    createUserGroupMember.mockRejectedValue(new Error(errorMessage));

    render(<AddUserGroupMemberForm setFormCompleted={setFormCompleted} id={userGroupId} />);

    await selectUser('Miller');

    const submitButton = screen.getByRole('button', { name: 'Add User' });

    await act(async () => {
      submitButton.click();
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'create-user-group-member-failed',
        title: 'Failed to Add User Group Member',
        message: 'Unable to add member. Please try again later.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    });
  });

});
