import DeleteUserGroupModal from './DeleteUserGroupModal';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useDeleteUserGroup from '@/features/settings/api/user-groups/delete-user-group';

jest.mock('@mantine/notifications');
jest.mock('@/features/settings/api/user-groups/delete-user-group');

type DeleteUserGroupModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  userGroupId: string;
}>;

const renderModal = (props: DeleteUserGroupModalProps) => {
  render(
    <DeleteUserGroupModal
      modalOpened={props.modalOpened}
      closeModalHandler={props.closeModalHandler}
      userGroupId={props.userGroupId}
    />
  );
};

describe('DeleteUserGroupModal', () => {

  const closeModalHandler = jest.fn();
  const mockDeleteUserGroup = jest.fn();
  const userGroupId = '6b54ffcd-c884-45c9-aa6e-57347f4cc156';

  let modalOpened: boolean;

  (useDeleteUserGroup as jest.Mock).mockReturnValue({
    mutateAsync: mockDeleteUserGroup,
    isPending: false,
    error: null,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    modalOpened = true;
  });

  it('renders the modal with the correct props', () => {
    renderModal({ modalOpened: modalOpened, closeModalHandler: closeModalHandler, userGroupId: userGroupId });

    expect(screen.getByTestId('delete-userGroup-modal')).toBeInTheDocument();
    expect(screen.getByText('Delete User Group')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this User Group?')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('does not render modal if modalOpened is false', () => {
    modalOpened = false;
    renderModal({ modalOpened: modalOpened, closeModalHandler: closeModalHandler, userGroupId: userGroupId });

    expect(screen.queryByText('Delete User Group')).not.toBeInTheDocument();
    expect(screen.queryByText('Are you sure you want to delete this User Group?')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('calls the closeModalHandler when cancel button is clicked', () => {
    renderModal({ modalOpened: modalOpened, closeModalHandler: closeModalHandler, userGroupId: userGroupId });

    fireEvent.click(screen.getByText('Cancel'));

    expect(closeModalHandler).toHaveBeenCalledTimes(1);
  });

  it('calls the deleteUserGroup API when delete button is clicked', () => {
    renderModal({ modalOpened: modalOpened, closeModalHandler: closeModalHandler, userGroupId: userGroupId });

    fireEvent.click(screen.getByText('Delete'));

    expect(mockDeleteUserGroup).toHaveBeenCalledTimes(1);
  });

  it('displays a notification toast upon error', async () => {
    const mockError = new Error('Could not delete user group');

    (useDeleteUserGroup as jest.Mock).mockReturnValue({
      mutateAsync: mockDeleteUserGroup.mockRejectedValue(mockError),
      isPending: false,
      error: mockError,
    });

    renderModal({ modalOpened: modalOpened, closeModalHandler: closeModalHandler, userGroupId: userGroupId });

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockDeleteUserGroup).toBeCalled();
    });

    expect(notifications.show).toHaveBeenCalledWith({
      title: 'Failed to Delete User Group',
      message: mockError.message || 'There was a problem deleting the user group',
      icon: <IconX />,
      autoClose: false,
      variant: 'failed_operation',
    });
  });

});
