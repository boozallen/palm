import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import useDeleteTemplate from '@/features/settings/api/templates/delete-template';

type DeleteTemplateModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  id: string;
  name: string;
}>;

export default function DeleteTemplateModal({
  modalOpened,
  closeModalHandler,
  id,
  name,
}: DeleteTemplateModalProps) {
  const {
    mutateAsync: deleteTemplate,
    isPending: deleteTemplateIsPending,
    error: deleteTemplateError,
  } = useDeleteTemplate();

  const handleDelete = async () => {
    try {
      await deleteTemplate({ templateId: id });
      closeModalHandler();
    } catch {
      notifications.show({
        id: 'delete-template-error',
        title: 'Failed to Delete Template',
        message: deleteTemplateError?.message ?? 'Unable to delete template. Please try again later.',
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
      title='Delete Template'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        Are you sure you want to delete <strong>{name}</strong>? This cannot be undone.
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>Cancel</Button>
        <Button onClick={handleDelete} loading={deleteTemplateIsPending}>
          {deleteTemplateIsPending ? 'Deleting' : 'Delete'}
        </Button>
      </Group>
    </Modal>
  );
}
