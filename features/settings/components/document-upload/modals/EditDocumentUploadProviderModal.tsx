import { useEffect, useState } from 'react';
import { Modal } from '@mantine/core';

import { SanitizedDocumentUploadProvider } from '@/features/shared/types/document-upload-provider';
import EditDocumentUploadProviderForm from '@/features/settings/components/document-upload/forms/EditDocumentUploadProviderForm';

type EditDocumentUploadProviderModalProps = {
  provider: SanitizedDocumentUploadProvider;
  opened: boolean;
  handleCloseModal: () => void;
};

export default function EditDocumentUploadProviderModal({
  provider,
  opened,
  handleCloseModal,
}: Readonly<EditDocumentUploadProviderModalProps>) {
  const [formCompleted, setFormCompleted] = useState<boolean>(false);

  useEffect(() => {
    if (formCompleted) {
      setFormCompleted(false);
      handleCloseModal();
    }
  }, [formCompleted, handleCloseModal]);

  return (
    <Modal
      title='Edit Document Upload Provider'
      opened={opened}
      onClose={handleCloseModal}
      withCloseButton={false}
      centered
      closeOnClickOutside={false}
      size='lg'
    >
      <EditDocumentUploadProviderForm
        provider={provider}
        setFormCompleted={setFormCompleted}
      />
    </Modal>
  );
}
