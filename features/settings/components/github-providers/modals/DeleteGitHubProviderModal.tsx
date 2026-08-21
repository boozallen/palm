import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useDeleteGitHubProvider from '@/features/settings/api/github-providers/delete-github-provider';

type DeleteGitHubProviderModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  providerId: string;
}>;

export default function DeleteGitHubProviderModal({
  modalOpened,
  closeModalHandler,
  providerId,
}: DeleteGitHubProviderModalProps) {
  const { mutateAsync: deleteGitHubProvider, error: deleteGitHubProviderError } = useDeleteGitHubProvider();

  const handleDelete = async () => {
    try {
      await deleteGitHubProvider({ id: providerId });
      closeModalHandler();
    } catch (error) {
      notifications.show({
        title: 'Remove GitHub Provider failed',
        message: deleteGitHubProviderError?.message,
        icon: <IconX />,
        autoClose: true,
        variant: 'failed_operation',
      });
    }
  };

  return (
    <Modal
      opened={modalOpened}
      onClose={closeModalHandler}
      withCloseButton={false}
      title='Delete GitHub Provider'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        Are you sure you want to delete this GitHub Provider?
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>Cancel</Button>
        <Button onClick={handleDelete}>Delete Provider</Button>
      </Group>
    </Modal>
  );
}
