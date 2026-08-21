import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { Button, Group, Modal, Text } from '@mantine/core';
import { useDeleteWorkflow } from '@/features/workflows/api/delete-workflow';

type DeleteWorkflowModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  workflowId: string;
  workflowName: string;
  onDeleteSuccess?: () => void;
}>;

export default function DeleteWorkflowModal({ 
  modalOpened, 
  closeModalHandler, 
  workflowId, 
  workflowName,
  onDeleteSuccess,
}: DeleteWorkflowModalProps) {

  const { mutateAsync: deleteWorkflow, error: deleteWorkflowError, isPending } = useDeleteWorkflow();
  
  const handleDeleteWorkflow = async () => {
    try {
      await deleteWorkflow({ workflowId });
      closeModalHandler();
      if (onDeleteSuccess) {
        onDeleteSuccess();
      }
    } catch (error) {
      notifications.show({
        title: 'Failed to delete workflow',
        message: deleteWorkflowError?.message,
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
      title='Delete Workflow'
      data-testid='delete-workflow-modal'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        Are you sure you want to delete &apos;{workflowName}&apos;?
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>Cancel</Button>
        <Button onClick={handleDeleteWorkflow} loading={isPending}>Delete Workflow</Button>
      </Group>
    </Modal>
  );
}
