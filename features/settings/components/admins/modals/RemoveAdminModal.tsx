import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import useUpdateUserRole from '@/features/settings/api/update-user-role';
import { UserRole } from '@/features/shared/types/user';

type RemoveAdminModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  id: string;
  name: string;
}>;

export default function RemoveAdminModal({
  modalOpened,
  closeModalHandler,
  id,
  name,
}: RemoveAdminModalProps) {

  const {
    mutateAsync: updateUserRole,
    isPending: updateUserRoleIsPending,
    error: updateUserRoleError,
  } = useUpdateUserRole();

  const handleRemoveAdmin = async () => {
    try {
      await updateUserRole({ id: id, role: UserRole.User });
      closeModalHandler();
    } catch (error) {
      notifications.show({
        id: 'update-user-role-error',
        title: 'Failed to Update User Role',
        message: updateUserRoleError?.message ?? 'Unable to update user role. Please try again later.',
        autoClose: false,
        withCloseButton: true,
        icon: <IconX />,
        variant: 'failed_operation',
      });
    }
  };

  return (
    <Modal
      opened={modalOpened}
      onClose={closeModalHandler}
      withCloseButton={false}
      title='Remove Admin'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        Are you sure you want to remove <strong>{name}</strong> as an admin?
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>Cancel</Button>
        <Button onClick={handleRemoveAdmin} loading={updateUserRoleIsPending}>
          {updateUserRoleIsPending ? 'Removing' : 'Remove'}
        </Button>
      </Group>
    </Modal>
  );
}
