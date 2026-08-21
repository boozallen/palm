import { useEffect, useState } from 'react';
import { Modal } from '@mantine/core';

import AddChecklistItemForm from '@/features/settings/components/ai-agents/forms/swear/AddChecklistItemForm';

type AddChecklistItemModalProps = Readonly<{
  isOpened: boolean;
  closeModal: () => void;
  aiAgentId: string;
}>;

export default function AddChecklistItemModal({
  isOpened,
  closeModal,
  aiAgentId,
}: AddChecklistItemModalProps) {
  const [formCompleted, setFormCompleted] = useState<boolean>(false);

  useEffect(() => {
    if (formCompleted) {
      setFormCompleted(false);
      closeModal();
    }
  }, [formCompleted, closeModal]);

  return (
    <Modal
      title='Add Checklist Item'
      opened={isOpened}
      size='xl'
      onClose={closeModal}
      withCloseButton={false}
      centered
      closeOnClickOutside={false}
    >
      <AddChecklistItemForm aiAgentId={aiAgentId} closeForm={setFormCompleted} />
    </Modal>
  );
}
