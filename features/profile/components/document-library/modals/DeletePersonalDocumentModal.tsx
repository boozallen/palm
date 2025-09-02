import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useDeleteDocument from '@/features/shared/api/document-upload/delete-document';

type DeletePersonalDocumentModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  documentId: string;
}>;

export default function DeletePersonalDocumentModal({ modalOpened, closeModalHandler, documentId }: DeletePersonalDocumentModalProps) {

  const {
    mutateAsync: deleteDocument,
    isPending: deleteDocumentIsPending,
    error: deleteDocumentError,
  } = useDeleteDocument();

  const handleDeleteDocument = async () => {
    try {
      await deleteDocument({ documentId });
      closeModalHandler();
    } catch (error) {
      notifications.show({
        title: 'Failed to Delete Document',
        message: deleteDocumentError?.message ?? 'There was a problem deleting the document',
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
      title='Delete Document'
      data-testid='delete-personal-document-modal'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        Are you sure you want to delete this document?
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>Cancel</Button>
        <Button onClick={handleDeleteDocument} loading={deleteDocumentIsPending} disabled={deleteDocumentIsPending}>
          {deleteDocumentIsPending ? 'Deleting' : 'Delete'}
        </Button>
      </Group>
    </Modal>
  );
}
