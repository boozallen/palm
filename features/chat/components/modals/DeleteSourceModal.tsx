import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX, IconCheck } from '@tabler/icons-react';
import useDeleteDocument from '@/features/shared/api/document-upload/delete-document';

type DeleteSourceModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  sourceId: string;
  sourceLabel: string;
  onDeleteSuccess?: () => void;
}>;

export default function DeleteSourceModal({ 
  modalOpened, 
  closeModalHandler, 
  sourceId, 
  sourceLabel,
  onDeleteSuccess,
}: DeleteSourceModalProps) {
  const {
    mutateAsync: deleteDocument,
    isPending: deleteDocumentIsPending,
    error: deleteDocumentError,
  } = useDeleteDocument();

  const handleDeleteDocument = async () => {
    try {
      await deleteDocument({ documentId: sourceId });
      
      notifications.show({
        title: 'Document Deleted',
        message: `${sourceLabel} has been successfully deleted.`,
        icon: <IconCheck />,
        variant: 'successful_operation',
        autoClose: true,
      });
      
      closeModalHandler();
      onDeleteSuccess?.();
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

  if (!modalOpened) {
    return null;
  }

  return (
    <Modal
      opened={modalOpened}
      onClose={closeModalHandler}
      withCloseButton={false}
      title='Delete Document'
      data-testid='delete-source-modal'
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
