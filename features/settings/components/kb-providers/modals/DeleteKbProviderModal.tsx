import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useDeleteKbProvider from '@/features/settings/api/delete-kb-provider';

type DeleteKbProviderModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  kbProviderId: string;
}>;

export default function DeleteKbProviderModal({ modalOpened, closeModalHandler, kbProviderId }: DeleteKbProviderModalProps) {

  const { mutateAsync: deleteKbProvider, error: deleteKbProviderError } = useDeleteKbProvider();
  const handleDeleteKbProvider = async () => {
    try {
      await deleteKbProvider({ id: kbProviderId });
      closeModalHandler();
    } catch (error) {
      notifications.show({
        title: 'Remove Knowledge Base Provider failed',
        message: deleteKbProviderError?.message,
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
      title='Delete Knowledge Base Provider'
      data-test-id='delete-kbProvider-modal'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        Are you sure you want to delete this Knowledge Base Provider?
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>Cancel</Button>
        <Button onClick={handleDeleteKbProvider}>Delete Provider</Button>
      </Group>
    </Modal>
  );

}
