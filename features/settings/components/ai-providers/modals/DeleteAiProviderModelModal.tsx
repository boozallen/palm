import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { Button, Group, Modal, Text } from '@mantine/core';
import useDeleteAiProviderModel from '@/features/settings/api/delete-ai-provider-model';

type DeleteAiProviderModelModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  modelId: string;
}>;

export default function DeleteAiProviderModelModal({ modalOpened, closeModalHandler, modelId }: DeleteAiProviderModelModalProps) {

  const { mutateAsync: deleteAiProviderModel, error: deleteAiProviderModelError } = useDeleteAiProviderModel();
  const handleDeleteAiProviderModel = async () => {
    try {
      await deleteAiProviderModel({ modelId: modelId });
      closeModalHandler();
    } catch (error) {
      notifications.show({
        title: 'Failed to remove AI Provider model',
        message: deleteAiProviderModelError?.message,
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
      title='Delete AI Provider Model'
      data-testid='delete-aiProvider-model-modal'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        Are you sure you want to delete this AI Provider Model?
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>Cancel</Button>
        <Button onClick={handleDeleteAiProviderModel}>Delete Model</Button>
      </Group>
    </Modal>
  );

}
