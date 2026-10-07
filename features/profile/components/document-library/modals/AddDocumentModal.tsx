import { useEffect, useState } from 'react';
import { Modal } from '@mantine/core';

import AddDocumentForm from '@/features/profile/components/document-library/forms/AddDocumentForm';

type AddDocumentModalProps = {
  isModalOpen: boolean,
  closeModalHandler: () => void;
}

export default function AddDocumentModal(
  { isModalOpen, closeModalHandler }: Readonly<AddDocumentModalProps>
) {

  const [formCompleted, setFormCompleted] = useState<boolean>(false);

  useEffect(() => {
    if (formCompleted) {
      setFormCompleted(false);
      closeModalHandler();
    }
  }, [formCompleted, closeModalHandler]);

  return (
    <Modal
      title='Upload Document(s)'
      opened={isModalOpen}
      onClose={closeModalHandler}
      withCloseButton={false}
      centered
      closeOnClickOutside={false}
    >
      <AddDocumentForm
        setFormCompleted={setFormCompleted}
      />
    </Modal>
  );
}
