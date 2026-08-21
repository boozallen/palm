import { TRPCClientError } from '@trpc/client';
import { Box, Button, Group, PasswordInput, Select, TextInput } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { Dispatch, SetStateAction, useState } from 'react';

import {
  addDocumentUploadProviderSchema,
  AddProviderForm,
  DocumentUploadProviderConfig,
  documentUploadProviderSelectOptions,
  SanitizedDocumentUploadProvider,
} from '@/features/shared/types/document-upload-provider';
import { PasswordInputPlaceholder } from '@/features/shared/components/forms/PasswordInputPlaceholder';
import useUpdateDocumentUploadProvider from '@/features/settings/api/document-upload/update-document-upload-provider';

type ReplaceFields = {
  accessKeyId: boolean;
  secretAccessKey: boolean;
  sessionToken: boolean;
};

type EditDocumentUploadProviderFormProps = Readonly<{
  provider: SanitizedDocumentUploadProvider;
  setFormCompleted: Dispatch<SetStateAction<boolean>>;
}>;

export default function EditDocumentUploadProviderForm({
  provider,
  setFormCompleted,
}: EditDocumentUploadProviderFormProps) {
  const {
    mutateAsync: updateDocumentUploadProvider,
    isPending: updateIsPending,
  } = useUpdateDocumentUploadProvider();

  const [replaceFields, setReplaceFields] = useState<ReplaceFields>({
    accessKeyId: false,
    secretAccessKey: false,
    sessionToken: false,
  });

  const form = useForm<AddProviderForm>({
    initialValues: {
      label: provider.label,
      config: {
        providerType: `${provider.providerType}`,
        accessKeyId: '',
        secretAccessKey: '',
        sessionToken: '',
        region: '',
        s3Uri: provider.sourceUri,
      },
    },
    validate: zodResolver(addDocumentUploadProviderSchema),
  });

  const handleReplace = (field: keyof ReplaceFields) => {
    setReplaceFields((prev) => ({ ...prev, [field]: true }));
    form.setFieldValue(`config.${field}`, '');
  };

  const handleSubmit = async (values: AddProviderForm) => {
    const providerConfig: DocumentUploadProviderConfig = {
      ...values.config,
      providerType: Number(values.config.providerType),
    };

    try {
      await updateDocumentUploadProvider({ id: provider.id, label: values.label, config: providerConfig });
      setFormCompleted(true);
    } catch (error) {
      let message = 'There was a problem updating the document upload provider. Please try again later.';

      if (error instanceof Error || error instanceof TRPCClientError) {
        message = error.message;
      }

      notifications.show({
        id: 'update-document-upload-error',
        title: 'Update Provider Error',
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
        label='Document Upload Provider'
        disabled
        withinPortal={true}
        {...form.getInputProps('config.providerType')}
      />
      <TextInput
        label='Label'
        placeholder='Label your document upload provider'
        {...form.getInputProps('label')}
      />

      {!replaceFields.accessKeyId ? (
        <PasswordInputPlaceholder
          label='Access Key ID'
          handleReplace={() => handleReplace('accessKeyId')}
        />
      ) : (
        <PasswordInput
          label='Access Key ID'
          placeholder='Enter access key ID'
          autoFocus
          {...form.getInputProps('config.accessKeyId')}
        />
      )}

      {!replaceFields.secretAccessKey ? (
        <PasswordInputPlaceholder
          label='Secret Access Key'
          handleReplace={() => handleReplace('secretAccessKey')}
        />
      ) : (
        <PasswordInput
          label='Secret Access Key'
          placeholder='Enter secret access key'
          {...form.getInputProps('config.secretAccessKey')}
        />
      )}

      {!replaceFields.sessionToken ? (
        <PasswordInputPlaceholder
          label='Session Token'
          handleReplace={() => handleReplace('sessionToken')}
        />
      ) : (
        <PasswordInput
          label='Session Token'
          placeholder='Enter session token'
          {...form.getInputProps('config.sessionToken')}
        />
      )}

      <TextInput
        label='Region'
        description='Leave blank to keep existing value'
        placeholder='Enter region'
        {...form.getInputProps('config.region')}
      />
      <TextInput
        label='S3 URI'
        placeholder='Enter S3 URI'
        {...form.getInputProps('config.s3Uri')}
      />

      <Group spacing='lg' grow>
        <Button variant='outline' onClick={() => setFormCompleted(true)}>
          Cancel
        </Button>
        <Button type='submit' loading={updateIsPending}>
          {!updateIsPending ? 'Save Changes' : 'Saving'}
        </Button>
      </Group>
    </Box>
  );
}
