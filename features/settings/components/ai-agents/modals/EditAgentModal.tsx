import { Modal } from '@mantine/core';
import { useEffect, useState } from 'react';

import { AiAgentType } from '@/features/shared/types';
import EditAgentForm from '@/features/settings/components/ai-agents/forms/EditAgentForm';

type EditAgentModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  agent: {
    id: string;
    name: string;
    description: string;
    type: AiAgentType;
  };
}>;

export default function EditAgentModal({
  agent,
  modalOpened,
  closeModalHandler,
}: EditAgentModalProps) {
  const [formCompleted, setFormCompleted] = useState<boolean>(false);

  useEffect(() => {
    if (formCompleted) {
      setFormCompleted(false);
      closeModalHandler();
    }
  }, [formCompleted, closeModalHandler]);

  return (
    <Modal
      title='Edit AI Agent'
      opened={modalOpened}
      onClose={closeModalHandler}
      withCloseButton={false}
      closeOnClickOutside={false}
      centered
    >
      <EditAgentForm
        agent={{
          id: agent.id,
          name: agent.name,
          description: agent.description,
          type: agent.type,
        }}
        setFormCompleted={setFormCompleted}
      />
    </Modal>
  );
}
