import { useEffect, useState } from 'react';
import { Modal } from '@mantine/core';

import EditChecklistItemForm from '@/features/settings/components/ai-agents/forms/swear/EditChecklistItemForm';
import { ChecklistItemForm } from '@/features/settings/types';

type EditChecklistItemModalProps = Readonly<{
  isOpened: boolean;
  closeModal: () => void;
  checklistItemId: string;
  initialValues: ChecklistItemForm;
}>;

export default function EditChecklistItemModal({
  isOpened,
  closeModal,
  checklistItemId,
  initialValues,
}: EditChecklistItemModalProps) {
  const [formCompleted, setFormCompleted] = useState<boolean>(false);

  useEffect(() => {
    if (formCompleted) {
      setFormCompleted(false);
      closeModal();
    }
  }, [formCompleted, closeModal]);

  return (
    <Modal
      title='Edit Checklist Item'
      opened={isOpened}
      onClose={closeModal}
      withCloseButton={false}
      centered
      closeOnClickOutside={false}
      size='xl'
    >
      <EditChecklistItemForm
        checklistItemId={checklistItemId}
        initialValues={initialValues}
        closeForm={setFormCompleted}
      />
    </Modal>
  );
}
