import { act, render, screen } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import useUpdateUserRole from '@/features/settings/api/update-user-role';
import RemoveAdminModal from './RemoveAdminModal';

jest.mock('@mantine/notifications');
jest.mock('@/features/settings/api/update-user-role');

describe('RemoveAdminModal', () => {
  const closeModalHandler = jest.fn();
  const mutateAsync = jest.fn();

  const mockProps = {
    id: '54931f13-7db9-4a77-b9cd-785c2ab5c5d3',
    name: 'Doe, Alex [USA]',
    modalOpened: true,
    closeModalHandler,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useUpdateUserRole as jest.Mock).mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    });
  });

  it('renders modal if opened', () => {
    render(<RemoveAdminModal {...mockProps} />);

    expect(screen.getByText('Remove Admin')).toBeInTheDocument();
    expect(screen.getByText(mockProps.name)).toBeInTheDocument();
  });

  it('does not render modal if not opened', () => {
    render(<RemoveAdminModal {...mockProps} modalOpened={false} />);

    expect(screen.queryByText('Remove Admin')).not.toBeInTheDocument();
  });

  it('calls mutateAsync upon submission', () => {
    render(<RemoveAdminModal {...mockProps} />);

    screen.getByText('Remove').click();

    expect(mutateAsync).toHaveBeenCalledWith({
      id: mockProps.id,
      role: 'User',
    });
  });

  it('calls closeModalHandler upon cancel', () => {
    render(<RemoveAdminModal {...mockProps} />);

    screen.getByText('Cancel').click();

    expect(closeModalHandler).toHaveBeenCalled();
  });

  it('shows error notification if updateUserRole throws an error', async () => {
    const error = new Error('Failed to update user role');

    (useUpdateUserRole as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockRejectedValue(error),
      isPending: false,
      error,
    });

    render(<RemoveAdminModal {...mockProps} />);

    await act(async () => {
      screen.getByText('Remove').click();
    });

    expect(notifications.show).toHaveBeenCalledWith({
      id: 'update-user-role-error',
      title: 'Failed to Update User Role',
      message: error.message,
      autoClose: false,
      withCloseButton: true,
      icon: <IconX />,
      variant: 'failed_operation',
    });
  });

});
