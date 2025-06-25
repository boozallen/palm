import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@mantine/core';
import EditAiProviderForm from '@/features/settings/components/ai-providers/forms/EditAiProviderForm';
import useGetAiProvider from '@/features/settings/api/get-ai-provider';
import { passwordInputPlaceholder } from '@/features/shared/utils';

type EditAiProviderModalProps = Readonly<{
  aiProviderId: string;
  modalOpen: boolean,
  closeModalHandler: () => void;
}>

export default function EditAiProviderModal({ aiProviderId, modalOpen, closeModalHandler }: EditAiProviderModalProps) {
  const {
    data: aiProvider,
  } = useGetAiProvider({ id: aiProviderId });

  const [formCompleted, setFormCompleted] = useState<boolean>(false);

  const existingAiProviderConfig = useMemo(() => {
    if (aiProvider) {
      return {
        aiProvider: aiProvider.provider.typeId.toString(),
        label: aiProvider.provider.label,
        apiKey: passwordInputPlaceholder,
        accessKeyId: passwordInputPlaceholder,
        secretAccessKey: passwordInputPlaceholder,
        sessionToken: passwordInputPlaceholder,
        apiEndpoint: aiProvider.provider.config.apiEndpoint ?? '',
        region: aiProvider.provider.config.region ?? '',
        inputCostPerMillionTokens: aiProvider.provider.inputCostPerMillionTokens,
        outputCostPerMillionTokens: aiProvider.provider.outputCostPerMillionTokens,
      };
    }
    // Return a default configuration if aiProvider is not loaded yet.
    return {
      aiProvider: '',
      label: '',
      apiKey: passwordInputPlaceholder,
      accessKeyId: passwordInputPlaceholder,
      secretAccessKey: passwordInputPlaceholder,
      sessionToken: passwordInputPlaceholder,
      apiEndpoint: '',
      region: '',
      inputCostPerMillionTokens: 0,
      outputCostPerMillionTokens: 0,
    };
  }, [aiProvider]);

  useEffect(() => {
    if (formCompleted) {
      setFormCompleted(false);
      closeModalHandler();
    }
  }, [formCompleted, closeModalHandler]);

  return (
    <Modal
      title='Edit AI Provider'
      opened={modalOpen}
      onClose={closeModalHandler}
      withCloseButton={false}
      data-test-id='edit-ai-provider-modal'
      centered
      closeOnClickOutside={false}
    >
      {(aiProvider) &&
        <EditAiProviderForm
          aiProviderId={aiProviderId}
          initialValues={existingAiProviderConfig}
          setFormCompleted={setFormCompleted}
        />
      }
    </Modal>
  );
}
