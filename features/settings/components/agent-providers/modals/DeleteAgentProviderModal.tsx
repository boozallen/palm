import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useDeleteAgentProvider from '@/features/settings/api/agent-providers/delete-agent-provider';

type AgentProvider = {
  id: string;
  name: string;
};

type DeleteAgentProviderModalProps = {
  agentProvider: AgentProvider | null;
  modalOpen: boolean;
  closeModalHandler: () => void;
};

export default function DeleteAgentProviderModal({
  agentProvider,
  modalOpen,
  closeModalHandler,
}: Readonly<DeleteAgentProviderModalProps>) {
  const { mutateAsync: deleteAgentProvider, error: deleteAgentProviderError } = useDeleteAgentProvider();

  if (!agentProvider) {
    return null;
  }

  const handleDelete = async () => {
    try {
      await deleteAgentProvider({ id: agentProvider.id });
      closeModalHandler();
    } catch {
      notifications.show({
        title: 'Delete Agent Provider failed',
        message: deleteAgentProviderError?.message,
        icon: <IconX />,
        autoClose: true,
        variant: 'failed_operation',
      });
    }
  };

  return (
    <Modal
      title='Delete Agent Provider'
      opened={modalOpen}
      onClose={closeModalHandler}
      withCloseButton={false}
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        Are you sure you want to delete this Agent Provider?
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>Cancel</Button>
        <Button onClick={handleDelete}>Delete Provider</Button>
      </Group>
    </Modal>
  );
}
