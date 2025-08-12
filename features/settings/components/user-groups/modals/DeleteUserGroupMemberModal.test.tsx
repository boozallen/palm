import DeleteUserGroupMemberModal from './DeleteUserGroupMemberModal';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useDeleteUserGroupMembership from '@/features/settings/api/delete-user-group-membership';

jest.mock('@mantine/notifications');
jest.mock('@/features/settings/api/delete-user-group-membership');

type DeleteUserGroupMemberModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  userGroupId: string;
  userId: string;
}>;

const renderModal = (props: DeleteUserGroupMemberModalProps) => {
  render(
    <DeleteUserGroupMemberModal
      modalOpened={props.modalOpened}
      closeModalHandler={props.closeModalHandler}
      userGroupId={props.userGroupId}
      userId={props.userId}
    />
  );
};

describe('DeleteUserGroupMemberModal', () => {

  const closeModalHandler = jest.fn();
  const mockDeleteUserGroupMember = jest.fn();
  const userGroupId = '6b54ffcd-c884-45c9-aa6e-57347f4cc156';
  const userId = '7c44ffcd-c884-45c9-aa6e-57347f4cc156';

  let modalOpened: boolean;

  (useDeleteUserGroupMembership as jest.Mock).mockReturnValue({
    mutateAsync: mockDeleteUserGroupMember,
    isPending: false,
    error: null,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    modalOpened = true;
  });

  it('renders the modal with the correct props', () => {
    renderModal({ modalOpened: modalOpened, closeModalHandler: closeModalHandler, userGroupId: userGroupId, userId: userId });

    expect(screen.getByTestId('delete-user-group-member-modal')).toBeInTheDocument();
    expect(screen.getByText('Delete User Group Member')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this member?')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('does not render modal if modalOpened is false', () => {
    modalOpened = false;
    renderModal({ modalOpened: modalOpened, closeModalHandler: closeModalHandler, userGroupId: userGroupId, userId: userId });

    expect(screen.queryByText('Delete User Group Member')).not.toBeInTheDocument();
    expect(screen.queryByText('Are you sure you want to delete this member?')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('calls the closeModalHandler when cancel button is clicked', () => {
    renderModal({ modalOpened: modalOpened, closeModalHandler: closeModalHandler, userGroupId: userGroupId, userId: userId });

    fireEvent.click(screen.getByText('Cancel'));

    expect(closeModalHandler).toHaveBeenCalledTimes(1);
  });

  it('calls the deleteUserGroupMembership API when delete button is clicked', () => {
    renderModal({ modalOpened: modalOpened, closeModalHandler: closeModalHandler, userGroupId: userGroupId, userId: userId });

    fireEvent.click(screen.getByText('Delete'));

    expect(mockDeleteUserGroupMember).toHaveBeenCalledTimes(1);
  });

  it('displays a notification toast upon error', async () => {
    const mockError = new Error('Could not delete user group member');

    (useDeleteUserGroupMembership as jest.Mock).mockReturnValue({
      mutateAsync: mockDeleteUserGroupMember.mockRejectedValue(mockError),
      isPending: false,
      error: mockError,
    });

    renderModal({ modalOpened: modalOpened, closeModalHandler: closeModalHandler, userGroupId: userGroupId, userId: userId });

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockDeleteUserGroupMember).toBeCalled();
    });

    expect(notifications.show).toHaveBeenCalledWith({
      title: 'Failed to Delete User Group Member',
      message: mockError.message || 'There was a problem deleting the user group member',
      icon: <IconX />,
      autoClose: false,
      variant: 'failed_operation',
    });
  });

});
