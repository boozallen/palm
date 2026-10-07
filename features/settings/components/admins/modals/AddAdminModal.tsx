import { useEffect, useState } from 'react';
import { Modal } from '@mantine/core';

import AddAdminForm from '@/features/settings/components/admins/forms/AddAdminForm';

type AddAdminModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
}>;

export default function AddAdminModal({ modalOpened, closeModalHandler }: AddAdminModalProps) {
  const [formCompleted, setFormCompleted] = useState<boolean>(false);

  useEffect(() => {
    if (formCompleted) {
      setFormCompleted(false);
      closeModalHandler();
    }
  }, [formCompleted, closeModalHandler]);

  return (
    <Modal
      opened={modalOpened}
      onClose={closeModalHandler}
      withCloseButton={false}
      title='Add Admin'
      centered
    >
      <AddAdminForm setFormCompleted={setFormCompleted} />
    </Modal>
  );
}
