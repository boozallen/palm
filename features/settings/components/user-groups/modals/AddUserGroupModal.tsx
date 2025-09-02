import { useEffect, useState } from 'react';
import { Modal } from '@mantine/core';
import AddUserGroupForm from '@/features/settings/components/user-groups/forms/AddUserGroupForm';

type AddUserGroupModalProps = {
  modalOpen: boolean,
  closeModalHandler: () => void;
}

export default function AddUserGroupModal({ modalOpen, closeModalHandler }: Readonly<AddUserGroupModalProps>) {

  const [formCompleted, setFormCompleted] = useState<boolean>(false);

  useEffect(() => {
    if (formCompleted) {
      setFormCompleted(false);
      closeModalHandler();
    }
  }, [formCompleted, closeModalHandler]);

  return (
    <Modal
      title='Add User Group'
      opened={modalOpen}
      onClose={closeModalHandler}
      withCloseButton={false}
      centered
      closeOnClickOutside={false}
    >
      <AddUserGroupForm setFormCompleted={setFormCompleted} />
    </Modal>
  );
}
