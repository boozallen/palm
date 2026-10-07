import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useDeleteUserGroupMembership from '@/features/settings/api/user-groups/delete-user-group-membership';

type DeleteUserGroupMemberModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  userGroupId: string;
  userId: string;
}>;

export default function DeleteUserGroupMemberModal({ modalOpened, closeModalHandler, userGroupId, userId }: DeleteUserGroupMemberModalProps) {

  const {
    mutateAsync: deleteUserGroupMember,
    isPending: deleteUserGroupMemberIsPending,
    error: deleteUserGroupMemberError,
  } = useDeleteUserGroupMembership();

  const handleDeleteUserGroupMember = async () => {
    try {
      await deleteUserGroupMember({ userGroupId: userGroupId, userId: userId });
      closeModalHandler();
    } catch (error) {
      notifications.show({
        title: 'Failed to Delete User Group Member',
        message: deleteUserGroupMemberError?.message ?? 'There was a problem deleting the user group member',
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
      title='Delete User Group Member'
      data-testid='delete-user-group-member-modal'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        Are you sure you want to delete this member?
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>Cancel</Button>
        <Button onClick={handleDeleteUserGroupMember} loading={deleteUserGroupMemberIsPending} disabled={deleteUserGroupMemberIsPending}>
          {deleteUserGroupMemberIsPending ? 'Deleting' : 'Delete'}
        </Button>
      </Group>
    </Modal>
  );

}
