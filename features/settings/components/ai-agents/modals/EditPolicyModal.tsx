import { useEffect, useState } from 'react';
import { Modal } from '@mantine/core';

import EditPolicyForm from '@/features/settings/components/ai-agents/forms/EditPolicyForm';
import { PolicyForm } from '@/features/settings/types';

type EditPolicyModalProps = Readonly<{
  isOpened: boolean;
  closeModal: () => void;
  policyId: string;
  initialValues: PolicyForm;
}>;

export default function EditPolicyModal({
  isOpened,
  closeModal,
  policyId,
  initialValues,
}: EditPolicyModalProps) {
  const [formCompleted, setFormCompleted] = useState<boolean>(false);

  useEffect(() => {
    if (formCompleted) {
      setFormCompleted(false);
      closeModal();
    }
  }, [formCompleted, closeModal]);

  return (
    <Modal
      title='Edit Policy'
      opened={isOpened}
      onClose={closeModal}
      withCloseButton={false}
      centered
      closeOnClickOutside={false}
      size='xl'
    >
      <EditPolicyForm
        policyId={policyId}
        initialValues={initialValues}
        closeForm={setFormCompleted}
      />
    </Modal>
  );
}
