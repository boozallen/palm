import { useEffect, useState } from 'react';
import { Flex, Modal } from '@mantine/core';
import EditAgentProviderForm from '@/features/settings/components/agent-providers/forms/EditAgentProviderForm';

type AgentProvider = {
  id: string;
  name: string;
  description: string;
  endpoint: string;
};

type EditAgentProviderModalProps = {
  agentProvider: AgentProvider | null;
  modalOpen: boolean;
  closeModalHandler: () => void;
};

export default function EditAgentProviderModal({
  agentProvider,
  modalOpen,
  closeModalHandler,
}: Readonly<EditAgentProviderModalProps>) {
  const [formCompleted, setFormCompleted] = useState(false);

  useEffect(() => {
    if (formCompleted) {
      setFormCompleted(false);
      closeModalHandler();
    }
  }, [formCompleted, closeModalHandler]);

  if (!agentProvider) {
    return null;
  }

  return (
    <Modal
      title='Edit Agent Provider'
      opened={modalOpen}
      onClose={closeModalHandler}
      withCloseButton={false}
      centered
      closeOnClickOutside={false}
    >
      <Flex direction='column'>
        <EditAgentProviderForm
          agentProvider={agentProvider}
          setFormCompleted={setFormCompleted}
        />
      </Flex>
    </Modal>
  );
}
