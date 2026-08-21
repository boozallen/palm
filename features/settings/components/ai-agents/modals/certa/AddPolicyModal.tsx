import { useEffect, useState } from 'react';
import { Modal } from '@mantine/core';

import AddPolicyForm from '@/features/settings/components/ai-agents/forms/certa/AddPolicyForm';

type AddPolicyModalProps = Readonly<{
  isOpened: boolean;
  closeModal: () => void;
  aiAgentId: string;
}>

export default function AddPolicyModal({
  isOpened,
  closeModal,
  aiAgentId,
}: AddPolicyModalProps) {

  const [formCompleted, setFormCompleted] = useState<boolean>(false);

  useEffect(() => {
    if (formCompleted) {
      setFormCompleted(false);
      closeModal();
    }
  }, [formCompleted, closeModal]);

  return (
    <Modal
      title='Add Policy'
      opened={isOpened}
      size='xl'
      onClose={closeModal}
      withCloseButton={false}
      centered
      closeOnClickOutside={false}
    >
      <AddPolicyForm aiAgentId={aiAgentId} closeForm={setFormCompleted} />
    </Modal>
  );
}
