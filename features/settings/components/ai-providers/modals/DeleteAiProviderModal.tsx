import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useDeleteAiProvider from '@/features/settings/api/ai-providers/delete-ai-provider';

type DeleteAiProviderModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  aiProviderId: string;
}>;

export default function DeleteAiProviderModal({ modalOpened, closeModalHandler, aiProviderId }: DeleteAiProviderModalProps) {

  const { mutateAsync: deleteAiProvider, error: deleteAiProviderError } = useDeleteAiProvider();
  const handleDeleteAiProvider = async () => {
    try {
      await deleteAiProvider({ providerId: aiProviderId });
      closeModalHandler();
    } catch (error) {
      notifications.show({
        title: 'Remove Ai Provider failed',
        message: deleteAiProviderError?.message,
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
      title='Delete AI Provider'
      data-test-id='delete-aiProvider-modal'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        Are you sure you want to delete this AI Provider?
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>Cancel</Button>
        <Button onClick={handleDeleteAiProvider}>Delete Provider</Button>
      </Group>
    </Modal>
  );

}
