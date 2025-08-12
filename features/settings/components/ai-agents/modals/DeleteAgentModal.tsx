import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { TRPCClientError } from '@trpc/client';

import useDeleteAiAgent from '@/features/settings/api/ai-agents/delete-ai-agent';

type DeleteAgentModalProps = Readonly<{
  agentId: string;
  modalOpen: boolean;
  closeModalHandler: () => void;
}>;

export default function DeleteAgentModal({
  agentId,
  modalOpen,
  closeModalHandler,
}: DeleteAgentModalProps) {
  const {
    mutateAsync: deleteAiAgent,
    isPending: deleteAiAgentIsLoading,
  } = useDeleteAiAgent();

  const handleDelete = async () => {
    try {
      await deleteAiAgent({ agentId });
    } catch (error) {
      let message = 'Something went wrong, please try again later.';

      if (error instanceof Error || error instanceof TRPCClientError) {
        message = error.message;
      }

      notifications.show({
        id: 'delete-agent-error',
        title: 'Error Deleting Agent',
        message,
        icon: <IconX />,
        autoClose: true,
        variant: 'failed_operation',
      });
    }
  };

  return (
    <Modal
      title='Delete AI Agent'
      opened={modalOpen}
      onClose={closeModalHandler}
      withCloseButton={false}
      centered
      closeOnClickOutside={false}
    >
      <Text c='gray.7' fz='sm' mb='md'>
        Are you sure you want to delete this agent?
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>Cancel</Button>
        <Button
          onClick={handleDelete}
          loading={deleteAiAgentIsLoading}
        >
          {!deleteAiAgentIsLoading ? 'Delete Agent' : 'Deleting Agent'}
        </Button>
      </Group>
    </Modal>
  );
}
