import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { useSession } from 'next-auth/react';

import { UserRole } from '@/features/shared/types/user';
import useUpdateUserRole from '@/features/settings/api/update-user-role';
import useGetUsersListWithRole from '@/features/settings/api/get-users-list-with-role';
import AddAdminForm from './AddAdminForm';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));
jest.mock('@mantine/notifications');

jest.mock('@/features/settings/api/update-user-role');
jest.mock('@/features/settings/api/get-users-list-with-role');

async function selectUser(query: string) {
  const userSelect = screen.getByLabelText('User');

  userSelect.click();

  await userEvent.type(userSelect, query);
  fireEvent.keyDown(userSelect, { key: 'ArrowDown' });
  fireEvent.keyDown(userSelect, { key: 'Enter' });

  return userSelect;
}

describe('AddAdminForm', () => {
  const setFormCompleted = jest.fn();
  const updateUserRole = jest.fn();
  const mockUserId = '6dd8ab24-48d1-441b-b332-27f8d3604e0c';

  beforeEach(() => {
    (useUpdateUserRole as jest.Mock).mockReturnValue({
      mutateAsync: updateUserRole,
      isPending: false,
      error: undefined,
    });

    (useGetUsersListWithRole as jest.Mock).mockReturnValue({
      data: {
        users: [
          {
            id: '50fa3ce5-bcc0-478c-aebf-c3627875e13d',
            name: 'Doe, Alex',
            email: 'doe_alex@domain.com',
            role: UserRole.User,
          },
        ],
      },
      isPending: false,
      error: undefined,
    });

    (useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          id: mockUserId,
        },
      },
    });
  });

  it('renders correct form field', () => {
    render(<AddAdminForm setFormCompleted={setFormCompleted} />);
    const userSelect = screen.getByLabelText('User');

    expect(userSelect).toBeInTheDocument();
    expect(userSelect).toHaveAttribute('placeholder', 'Search by name or email');
  });

  it('renders correct validation error', async () => {
    render(<AddAdminForm setFormCompleted={setFormCompleted} />);
    const submitButton = screen.getByRole('button', { name: 'Add Admin' });

    await act(async () => {
      submitButton.click();
    });

    await waitFor(() => {
      expect(screen.queryByText('A user must be selected')).toBeInTheDocument();
      expect(updateUserRole).not.toHaveBeenCalled();
    });
  });

  it('submits form with correct values', async () => {
    render(<AddAdminForm setFormCompleted={setFormCompleted} />);

    const userSelect = await selectUser('Doe');

    expect(userSelect).toHaveValue('Doe, Alex (doe_alex@domain.com)');

    const submitButton = screen.getByRole('button', { name: 'Add Admin' });

    await act(async () => {
      submitButton.click();
    });

    await waitFor(() => {
      expect(updateUserRole).toHaveBeenCalledWith({
        id: '50fa3ce5-bcc0-478c-aebf-c3627875e13d',
        role: UserRole.Admin,
      });
    });
  });

  it('displays notification toast if api call fails', async () => {
    const errorMessage = 'Error adding user to group';
    updateUserRole.mockRejectedValue(new Error(errorMessage));

    render(<AddAdminForm setFormCompleted={setFormCompleted} />);

    await selectUser('Doe');

    const submitButton = screen.getByRole('button', { name: 'Add Admin' });

    await act(async () => {
      submitButton.click();
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'update-user-role-failed',
        title: 'Failed to Update User Role',
        message:
          'Unable to update user role at this time. Please try again later.',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    });
  });
});
