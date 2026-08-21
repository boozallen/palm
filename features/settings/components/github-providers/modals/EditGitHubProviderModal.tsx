import { useEffect, useState } from 'react';
import { Flex, Modal } from '@mantine/core';
import EditGitHubProviderForm from '@/features/settings/components/github-providers/forms/EditGitHubProviderForm';

type EditGitHubProviderModalProps = {
  modalOpen: boolean;
  closeModalHandler: () => void;
  providerId: string;
  currentLabel: string;
  currentApiBaseUrl: string;
  currentOwner: string;
  currentRepo: string;
  currentDescription: string;
  currentIsSkillRepo: boolean;
  currentSkillRepoBranch: string | null;
  currentSkillRepoServiceUrl: string | null;
};

export default function EditGitHubProviderModal({
  modalOpen,
  closeModalHandler,
  providerId,
  currentLabel,
  currentApiBaseUrl,
  currentOwner,
  currentRepo,
  currentDescription,
  currentIsSkillRepo,
  currentSkillRepoBranch,
  currentSkillRepoServiceUrl,
}: Readonly<EditGitHubProviderModalProps>) {
  const [formCompleted, setFormCompleted] = useState(false);

  useEffect(() => {
    if (formCompleted) {
      setFormCompleted(false);
      closeModalHandler();
    }
  }, [formCompleted, closeModalHandler]);

  return (
    <Modal
      title='Edit GitHub Provider'
      opened={modalOpen}
      onClose={closeModalHandler}
      withCloseButton={false}
      centered
      closeOnClickOutside={false}
    >
      <Flex direction='column'>
        <EditGitHubProviderForm
          providerId={providerId}
          currentLabel={currentLabel}
          currentApiBaseUrl={currentApiBaseUrl}
          currentOwner={currentOwner}
          currentRepo={currentRepo}
          currentDescription={currentDescription}
          currentIsSkillRepo={currentIsSkillRepo}
          currentSkillRepoBranch={currentSkillRepoBranch}
          currentSkillRepoServiceUrl={currentSkillRepoServiceUrl}
          setFormCompleted={setFormCompleted}
        />
      </Flex>
    </Modal>
  );
}
