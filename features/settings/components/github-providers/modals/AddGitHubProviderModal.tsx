import { useEffect, useState } from 'react';
import { Flex, Modal } from '@mantine/core';
import AddGitHubProviderForm from '@/features/settings/components/github-providers/forms/AddGitHubProviderForm';

type AddGitHubProviderModalProps = {
  modalOpen: boolean;
  closeModalHandler: () => void;
};

export default function AddGitHubProviderModal({
  modalOpen,
  closeModalHandler,
}: Readonly<AddGitHubProviderModalProps>) {
  const [formCompleted, setFormCompleted] = useState(false);

  useEffect(() => {
    if (formCompleted) {
      setFormCompleted(false);
      closeModalHandler();
    }
  }, [formCompleted, closeModalHandler]);

  return (
    <Modal
      title='Add GitHub Provider'
      opened={modalOpen}
      onClose={closeModalHandler}
      withCloseButton={false}
      centered
      closeOnClickOutside={false}
    >
      <Flex direction='column'>
        <AddGitHubProviderForm setFormCompleted={setFormCompleted} />
      </Flex>
    </Modal>
  );
}
