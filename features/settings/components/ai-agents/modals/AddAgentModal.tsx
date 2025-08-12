import { Modal } from '@mantine/core';
import { useEffect, useState } from 'react';

import AddAgentForm from '@/features/settings/components/ai-agents/forms/AddAgentForm';

type AddAgentModalProps = Readonly<{
  modalOpen: boolean;
  closeModalHandler: () => void;
}>;

export default function AddAgentModal({ modalOpen, closeModalHandler }: AddAgentModalProps) {
  const [formCompleted, setFormCompleted] = useState<boolean>(false);

  useEffect(() => {
    if (formCompleted) {
      setFormCompleted(false);
      closeModalHandler();
    }
  }, [formCompleted, closeModalHandler]);

  return (
    <Modal
      title='Add AI Agent'
      opened={modalOpen}
      onClose={closeModalHandler}
      withCloseButton={false}
      centered
      closeOnClickOutside={false}
    >
      <AddAgentForm setFormCompleted={setFormCompleted}/>
    </Modal>
  );
}
