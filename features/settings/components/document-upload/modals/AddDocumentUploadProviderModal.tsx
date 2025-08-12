import { useEffect, useState } from 'react';
import { Modal } from '@mantine/core';

import AddDocumentUploadProviderForm from '@/features/settings/components/document-upload/forms/AddDocumentUploadProviderForm';

type AddDocumentUploadProviderModalProps = {
  opened: boolean;
  handleCloseModal: () => void;
}

export default function AddDocumentUploadProviderModal({
  opened,
  handleCloseModal,
}: AddDocumentUploadProviderModalProps) {
    const [formCompleted, setFormCompleted] = useState<boolean>(false);

    useEffect(() => {
      if (formCompleted) {
        setFormCompleted(false);
        handleCloseModal();
      }
    }, [formCompleted, handleCloseModal]);

  return (
    <Modal
      title='Add Document Upload Provider'
      opened={opened}
      onClose={handleCloseModal}
      withCloseButton={false}
      centered
      closeOnClickOutside={false}
      size='lg'
    >
      <AddDocumentUploadProviderForm setFormCompleted={setFormCompleted} />
    </Modal>
  );
}
