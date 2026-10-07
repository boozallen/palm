import { useEffect, useState } from 'react';
import { Flex, Modal } from '@mantine/core';
import AddAgentProviderForm from '@/features/settings/components/agent-providers/forms/AddAgentProviderForm';

type AddAgentProviderModalProps = {
  modalOpen: boolean;
  closeModalHandler: () => void;
};

export default function AddAgentProviderModal({
  modalOpen,
  closeModalHandler,
}: Readonly<AddAgentProviderModalProps>) {
  const [formCompleted, setFormCompleted] = useState(false);

  useEffect(() => {
    if (formCompleted) {
      setFormCompleted(false);
      closeModalHandler();
    }
  }, [formCompleted, closeModalHandler]);

  return (
    <Modal
      title='Add Agent Provider'
      opened={modalOpen}
      onClose={closeModalHandler}
      withCloseButton={true}
      centered
      closeOnClickOutside={false}
    >
      <Flex direction='column'>
        <AddAgentProviderForm setFormCompleted={setFormCompleted} onCancel={closeModalHandler} />
      </Flex>
    </Modal>
  );
}
