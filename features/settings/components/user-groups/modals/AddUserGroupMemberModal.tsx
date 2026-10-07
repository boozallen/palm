import { useEffect, useState } from 'react';
import { Modal } from '@mantine/core';
import AddUserGroupMemberForm from '@/features/settings/components/user-groups/forms/AddUserGroupMemberForm';

type AddUserGroupMemberModalProps = {
  modalOpen: boolean,
  closeModalHandler: () => void;
  id: string;
}

export default function AddUserGroupMemberModal({ modalOpen, closeModalHandler, id }: Readonly<AddUserGroupMemberModalProps>) {

  const [formCompleted, setFormCompleted] = useState<boolean>(false);

  useEffect(() => {
    if (formCompleted) {
      setFormCompleted(false);
      closeModalHandler();
    }
  }, [formCompleted, closeModalHandler]);

  return (
    <Modal
      title='Add User'
      opened={modalOpen}
      onClose={closeModalHandler}
      withCloseButton={false}
      centered
      closeOnClickOutside={false}
    >
      <AddUserGroupMemberForm setFormCompleted={setFormCompleted} id={id}/>
    </Modal>
  );
}
