import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { Button, Group, TextInput, Select } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import {
  KbProviderForm,
  KbProviderType,
  KbProvidersSelectInputOptions,
  KbProviderConfig,
  conditionalKbProviderSchema,
} from '@/features/shared/types';
import useAddKbProvider from '@/features/settings/api/add-kb-provider';
import { useGetFeatureFlag } from '@/features/shared/api/get-feature-flag';
import { features } from '@/libs/featureFlags';
import { AddKbProviderConfigInputs } from './AddKbProviderConfigInputs';

export type AddKbProviderFormProps = Readonly<{
  setFormCompleted: Dispatch<SetStateAction<boolean>>;
}>;

export default function AddKbProviderForm({ setFormCompleted }: AddKbProviderFormProps) {
  const [selectedKbProvider, setSelectedKbProvider] = useState<number>(0);
  const { data: featurePalmKB } = useGetFeatureFlag({ feature: features.PALM_KB });

  const { mutateAsync: addKbProvider, isPending: addKbProviderIsPending, error: addKbProviderError } = useAddKbProvider();

  function getFilteredSelectData(featurePalmKB: { isFeatureOn: boolean } | undefined) {
    let selectData = KbProvidersSelectInputOptions;
    if (!featurePalmKB?.isFeatureOn) {
      selectData = selectData.filter((x) => x.value !== String(KbProviderType.KbProviderPalm));
    }
    return selectData;
  }

  const selectData = getFilteredSelectData(featurePalmKB);

  const addKbProviderForm = useForm<KbProviderForm>({
    initialValues: {
      label: '',
      kbProviderType: 0,
      config: {
        apiKey: '',
        apiEndpoint: '',
      },
    },
    validate: zodResolver(conditionalKbProviderSchema(Number(selectedKbProvider) as KbProviderType)),
  });

  const { setValues } = addKbProviderForm;

  function getNewConfig(kbProviderNumber: number): KbProviderConfig {
    return kbProviderNumber === KbProviderType.KbProviderBedrock
      ? {
        accessKeyId: '',
        secretAccessKey: '',
        sessionToken: '',
        region: '',
      }
      : {
        apiKey: '',
        apiEndpoint: '',
      };
  }

  function updateSelectedKbProvider(
    kbProviderType: number,
    selectedKbProvider: number,
    setSelectedKbProvider: Dispatch<SetStateAction<number>>,
    setValues: (values: Partial<KbProviderForm>) => void
  ) {
    const kbProviderNumber = Number(kbProviderType);
    if (!isNaN(kbProviderNumber) && selectedKbProvider !== kbProviderNumber) {
      setSelectedKbProvider(kbProviderNumber);
      const newConfig = getNewConfig(kbProviderNumber);
      setValues({
        kbProviderType: kbProviderNumber,
        config: newConfig,
      });
    }
  }

  useEffect(() => {
    updateSelectedKbProvider(addKbProviderForm.values.kbProviderType, selectedKbProvider, setSelectedKbProvider, setValues);
  }, [addKbProviderForm.values.kbProviderType, selectedKbProvider, setValues]);

  function buildNewKbProvider(values: KbProviderForm): KbProviderForm {
    const kbProviderConfig: { [k: string]: any } = {};
    for (const [key, value] of Object.entries(values.config)) {
      kbProviderConfig[key] = value;
    }
    return {
      label: values.label,
      kbProviderType: Number(values.kbProviderType) as KbProviderType,
      config: kbProviderConfig as KbProviderConfig,
    };
  }

  const handleFormCompletion = () => {
    addKbProviderForm.reset();
    setFormCompleted(true);
  };

  const handleSubmit = async (values: KbProviderForm) => {
    try {
      await addKbProvider(buildNewKbProvider(values));
      handleFormCompletion();
    } catch (error) {
      notifications.show({
        id: 'add-kb-provider-error',
        title: 'Failed to Add Knowledge Base Provider',
        message: addKbProviderError?.message ?? 'Unable to add a knowledge base provider at this time. Please try again later',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    }
  };

  return (
    <form onSubmit={addKbProviderForm.onSubmit(handleSubmit)} data-testid='add-kb-provider-form'>
      <Select
        data={selectData}
        placeholder='Select Knowledge Base Provider'
        label='Knowledge Base Provider'
        withinPortal={true}
        {...addKbProviderForm.getInputProps('kbProviderType')}
        value={selectedKbProvider.toString()}
      />
      <TextInput
        label='Label'
        placeholder='Enter a label'
        {...addKbProviderForm.getInputProps('label')}
      />
      <AddKbProviderConfigInputs
        form={addKbProviderForm}
        selectedKbProvider={selectedKbProvider}
      />
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={handleFormCompletion}>
          Cancel
        </Button>
        <Button type='submit' loading={addKbProviderIsPending}>
          {addKbProviderIsPending ? 'Adding' : 'Add'}
        </Button>
      </Group>
    </form>
  );
}
