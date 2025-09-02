import { TRPCClientError } from '@trpc/client';
import { Box, Button, Group, Select, TextInput } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { Dispatch, SetStateAction, useEffect, useMemo } from 'react';

import {
  addDocumentUploadProviderSchema,
  AddProviderForm,
  DocumentUploadProviderConfig,
  documentUploadProviderSelectOptions,
  DocumentUploadProviderType,
  initializeConfigValuesForProviderType,
} from '@/features/shared/types/document-upload-provider';
import AddAwsProviderConfigForm from './AddAwsProviderConfigForm';
import useCreateDocumentUploadProvider from '@/features/settings/api/document-upload/create-document-upload-provider';

type AddDocumentUploadProviderFormProps = Readonly<{
  setFormCompleted: Dispatch<SetStateAction<boolean>>;
}>;

export default function AddDocumentUploadProviderForm({
  setFormCompleted,
}: AddDocumentUploadProviderFormProps) {
  const {
    mutateAsync: createDocumentUploadProvider,
    isPending: createDocumentUploadProviderIsPending,
  } = useCreateDocumentUploadProvider();

  const form = useForm<AddProviderForm>({
    initialValues: {
      label: '',
      config: initializeConfigValuesForProviderType[DocumentUploadProviderType.AWS],
    },
    validate: zodResolver(addDocumentUploadProviderSchema),
  });

  const { providerType } = form.values.config;
  const { setFieldValue } = form;

  useEffect(() => {
    const type = Number(providerType) as DocumentUploadProviderType;
    setFieldValue('config', initializeConfigValuesForProviderType[type]);
  }, [providerType, setFieldValue]);

  // Determine which config component to show based on selected config type
  const ConfigComponent: React.ElementType = useMemo(() => {
    const configComponents: Record<DocumentUploadProviderType, React.ElementType> = {
      [DocumentUploadProviderType.AWS]: AddAwsProviderConfigForm,
    };

    const configType = Number(providerType) as DocumentUploadProviderType;

    return configComponents[configType];
  }, [providerType]);

  const handleSubmit = async (values: AddProviderForm) => {
    const providerConfig: DocumentUploadProviderConfig = {
      ...values.config,
      /* Select values are always string, convert back to number and let TS handle the rest */
      providerType: Number(values.config.providerType),
    };

    try {
      await createDocumentUploadProvider({ label: values.label, config: providerConfig });
      setFormCompleted(true);
    } catch (error) {
      let message = 'There was a problem creating the document upload provider. Please try again later.';

      if (error instanceof Error || error instanceof TRPCClientError) {
        message = error.message;
      }

      notifications.show({
        id: 'create-document-upload-error',
        title: 'Create Provider Error',
        message,
        icon: <IconX />,
        autoClose: true,
        variant: 'failed_operation',
      });
    }
  };

  return (
    <Box component='form' onSubmit={form.onSubmit(handleSubmit)}>
      <Select
        data={documentUploadProviderSelectOptions}
        placeholder='Select document upload provider'
        label='Document Upload Provider'
        withinPortal={true}
        {...form.getInputProps('config.providerType')}
      />
      <TextInput
        label='Label'
        placeholder='Label your document upload provider'
        {...form.getInputProps('label')}
      />

      {ConfigComponent && <ConfigComponent form={form} />}

      <Group spacing='lg' grow>
        <Button variant='outline' onClick={setFormCompleted}>
          Cancel
        </Button>
        <Button
          type='submit'
          loading={createDocumentUploadProviderIsPending}
        >
          {!createDocumentUploadProviderIsPending ? 'Add Provider' : 'Adding Provider'}
        </Button>
      </Group>
    </Box>
  );
}
