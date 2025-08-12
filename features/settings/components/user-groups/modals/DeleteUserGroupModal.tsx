import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useDeleteUserGroup from '@/features/settings/api/delete-user-group';

type DeleteUserGroupModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  userGroupId: string;
}>;

export default function DeleteUserGroupModal({ modalOpened, closeModalHandler, userGroupId }: DeleteUserGroupModalProps) {

  const {
    mutateAsync: deleteUserGroup,
    isPending: deleteUserGroupIsPending,
    error: deleteUserGroupError,
  } = useDeleteUserGroup();

  const handleDeleteUserGroup = async () => {
    try {
      await deleteUserGroup({ id: userGroupId });
      closeModalHandler();
    } catch (error) {
      notifications.show({
        title: 'Failed to Delete User Group',
        message: deleteUserGroupError?.message ?? 'There was a problem deleting the user group',
        icon: <IconX />,
        autoClose: false,
        variant: 'failed_operation',
      });
    }
  };

  return (
    <Modal
      opened={modalOpened}
      onClose={closeModalHandler}
      withCloseButton={false}
      title='Delete User Group'
      data-testid='delete-userGroup-modal'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        Are you sure you want to delete this User Group?
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>Cancel</Button>
        <Button onClick={handleDeleteUserGroup} loading={deleteUserGroupIsPending} disabled={deleteUserGroupIsPending}>
          {deleteUserGroupIsPending ? 'Deleting' : 'Delete'}
        </Button>
      </Group>
    </Modal>
  );

}
