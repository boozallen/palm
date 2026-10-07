import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@mantine/core';
import useGetKbProvider from '@/features/settings/api/kb-providers/get-kb-provider';
import EditKbProviderForm
  from '@/features/settings/components/kb-providers/forms/EditKbProviderForm';
import {
  KbProviderConfig,
  SanitizedKbProviderConfig,
} from '@/features/shared/types';
import { passwordInputPlaceholder } from '@/features/shared/utils';

type EditKbProviderModalProps = Readonly<{
  kbProviderId: string;
  modalOpen: boolean,
  closeModalHandler: () => void;
}>

function buildKbProviderConfig(config: SanitizedKbProviderConfig): KbProviderConfig {
  if ('region' in config) {
    return {
      accessKeyId: passwordInputPlaceholder,
      secretAccessKey: passwordInputPlaceholder,
      sessionToken: passwordInputPlaceholder,
      region: config.region,
    };
  } else {
    return {
      apiKey: passwordInputPlaceholder,
      apiEndpoint: config.apiEndpoint,
    };
  }
};

export default function EditKbProviderModal({ kbProviderId, modalOpen, closeModalHandler }: EditKbProviderModalProps) {
  const { data } = useGetKbProvider(kbProviderId);

  const [formCompleted, setFormCompleted] = useState<boolean>(false);

  const existingKbProviderConfig = useMemo(() => {
    if (data) {
      const kbProvider = data.kbProvider;

      return {
        kbProviderType: kbProvider.kbProviderType,
        label: kbProvider.label,
        config: buildKbProviderConfig(kbProvider.config),
      };
    }
    // Return a default configuration if kbProvider is not loaded yet.
    return {
      kbProviderType: 0,
      label: '',
      config: {
        apiKey: passwordInputPlaceholder,
        apiEndpoint: '',
      },
    };
  }, [data]);

  useEffect(() => {
    if (formCompleted) {
      setFormCompleted(false);
      closeModalHandler();
    }
  }, [formCompleted, closeModalHandler]);

  return (
    <Modal
      title='Edit Knowledge Base Provider'
      opened={modalOpen}
      onClose={closeModalHandler}
      withCloseButton={false}
      data-test-id='edit-kb-provider-modal'
      centered
      closeOnClickOutside={false}
      size='lg'
    >
      {(data) &&
        <EditKbProviderForm
          kbProviderId={kbProviderId}
          initialValues={existingKbProviderConfig}
          setFormCompleted={setFormCompleted}
        />
      }
    </Modal>
  );
}
