import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { Button, Group, Select, TextInput } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import {
  conditionalKbProviderSchema,
  KbProviderConfig,
  KbProviderForm,
  KbProvidersSelectInputOptions,
  KbProviderType,
} from '@/features/shared/types';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useUpdateKbProvider from '@/features/settings/api/kb-providers/update-kb-provider';
import { passwordInputPlaceholder } from '@/features/shared/utils';
import { EditKbProviderConfigInputs } from './EditKbProviderConfigInputs';

export type EditKbProviderFormProps = Readonly<{
  kbProviderId: string;
  initialValues: KbProviderForm;
  setFormCompleted: Dispatch<SetStateAction<boolean>>;
}>;

export default function EditKbProviderForm({ kbProviderId, initialValues, setFormCompleted }: EditKbProviderFormProps) {

  const {
    mutateAsync: updateKbProvider,
    isPending: updateKbProviderIsPending,
    error: updateKbProviderError,
  } = useUpdateKbProvider();

  let selectData = KbProvidersSelectInputOptions;

  const [selectedKbProvider, setSelectedKbProvider] = useState<number>(0);

  useEffect(() => {
    const kbProviderNumber = Number(initialValues.kbProviderType);

    if (!isNaN(kbProviderNumber)) {
      setSelectedKbProvider(kbProviderNumber);
    }
  }, [initialValues.kbProviderType]);

  const editKbProviderForm = useForm<KbProviderForm>({
    initialValues,
    validate: zodResolver(
      conditionalKbProviderSchema(Number(selectedKbProvider) as KbProviderType)
    ),
  });

  const handleSubmit = async (values: KbProviderForm) => {
    try {
      // Conditionally build the config type
      const kbProviderConfig: { [k: string]: any } = {};
      for (const [key, value] of Object.entries(values.config)) {
        if (!value || value === passwordInputPlaceholder) {
          kbProviderConfig[key] = '';
        } else {
          kbProviderConfig[key] = value;
        }
      }

      const updatedKbProvider: KbProviderForm = {
        label: values.label,
        kbProviderType: Number(values.kbProviderType) as KbProviderType,
        config: kbProviderConfig as KbProviderConfig,
      };

      await updateKbProvider({
        id: kbProviderId,
        ...updatedKbProvider,
      });

      handleFormCompletion();
    } catch (error) {
      notifications.show({
        id: 'update-kb-provider-failure',
        title: 'Failed to Update Knowledge Base Provider',
        message: updateKbProviderError?.message ?? 'There was a problem saving your changes',
        icon: <IconX />,
        variant: 'failed_operation',
      });
    }
  };

  function handleFormCompletion() {
    editKbProviderForm.reset();
    setFormCompleted(true);
  }

  return (
    <form onSubmit={editKbProviderForm.onSubmit((values) => {
      handleSubmit(values);
    })}>
      <Select
        data={selectData}
        placeholder='Select Knowledge Base Provider'
        label='Knowledge Base Provider'
        disabled={true}
        {...editKbProviderForm.getInputProps('kbProviderType')}
        value={selectedKbProvider.toString()}
      />
      <TextInput
        label='Label'
        placeholder='Enter a label'
        {...editKbProviderForm.getInputProps('label')}
      />
      <EditKbProviderConfigInputs
        form={editKbProviderForm}
        selectedKbProvider={selectedKbProvider}
      />
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={handleFormCompletion}>
          Cancel
        </Button>
        <Button
          type='submit'
          disabled={!editKbProviderForm.isDirty()}
          loading={updateKbProviderIsPending}
        >
          {updateKbProviderIsPending ? 'Saving Changes' : 'Save Changes'}
        </Button>
      </Group>
    </form>
  );
}
