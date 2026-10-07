import { useEffect, useState } from 'react';
import { Modal } from '@mantine/core';
import AddKbProviderForm from '@/features/settings/components/kb-providers/forms/AddKbProviderForm';

type AddKbProviderModalProps = Readonly<{
  modalOpen: boolean,
  closeModalHandler: () => void;
}>

export default function AddKbProviderModal({ modalOpen, closeModalHandler }: AddKbProviderModalProps) {

  const [formCompleted, setFormCompleted] = useState<boolean>(false);

  useEffect(() => {
    if (formCompleted) {
      setFormCompleted(false);
      closeModalHandler();
    }
  }, [formCompleted, closeModalHandler]);

  return (
    <Modal
      title='Add KB Provider'
      opened={modalOpen}
      onClose={closeModalHandler}
      withCloseButton={false}
      data-testid='add-kb-provider-modal'
      centered
      closeOnClickOutside={false}
      size='lg'
    >
      <AddKbProviderForm setFormCompleted={setFormCompleted} />
    </Modal>
  );
}
