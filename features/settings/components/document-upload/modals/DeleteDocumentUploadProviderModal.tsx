import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { TRPCClientError } from '@trpc/client';

import useDeleteDocumentUploadProvider from '@/features/settings/api/document-upload/delete-document-upload-provider';

type DeleteDocumentUploadProviderModalProps = Readonly<{
  providerId: string;
  opened: boolean;
  closeModalHandler: () => void;
}>;

export default function DeleteDocumentUploadProviderModal({
  providerId,
  opened,
  closeModalHandler,
}: DeleteDocumentUploadProviderModalProps) {
  const {
    mutateAsync: deleteDocumentUploadProvider,
    isPending: deleteDocumentUploadProviderIsPending,
  } = useDeleteDocumentUploadProvider();

  const handleDelete = async () => {
    try {
      await deleteDocumentUploadProvider({ providerId });
    } catch (error) {
      let message = 'There was a problem deleting the provider';

      if (error instanceof Error || error instanceof TRPCClientError) {
        message = error.message;
      }

      notifications.show({
        id: 'delete-document-upload-provider-error',
        title: 'Something Went Wrong',
        message,
        icon: <IconX />,
        autoClose: true,
        variant: 'failed_operation',
      });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={closeModalHandler}
      withCloseButton={false}
      title='Delete Document Upload Provider'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        Are you sure you want to delete this document upload provider?
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>
          Cancel
        </Button>
        <Button
          loading={deleteDocumentUploadProviderIsPending}
          onClick={handleDelete}
        >
          {!deleteDocumentUploadProviderIsPending ? 'Delete Provider' : 'Deleting...'}
        </Button>
      </Group>
    </Modal>
  );
}
