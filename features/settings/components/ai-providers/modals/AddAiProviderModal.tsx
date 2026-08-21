import { useEffect, useState } from 'react';
import { Flex, Modal } from '@mantine/core';
import AddAiProviderForm from '@/features/settings/components/ai-providers/forms/AddAiProviderForm';

type AddAiProviderModalProps = {
  modalOpen: boolean,
  closeModalHandler: () => void;
}

export default function AddAiProviderModal({ modalOpen, closeModalHandler }: Readonly<AddAiProviderModalProps>) {

  const [formCompleted, setFormCompleted] = useState<boolean>(false);

  useEffect(() => {
    if (formCompleted) {
      setFormCompleted(false);
      closeModalHandler();
    }
  }, [formCompleted, closeModalHandler]);

  return (
    <Modal
      title='Add AI Provider'
      opened={modalOpen}
      onClose={closeModalHandler}
      withCloseButton={false}
      data-test-id='add-ai-provider-modal'
      centered
      closeOnClickOutside={false}
    >
      <Flex direction={'column'}>
        <AddAiProviderForm setFormCompleted={setFormCompleted} />
      </Flex>
    </Modal>
  );
}
