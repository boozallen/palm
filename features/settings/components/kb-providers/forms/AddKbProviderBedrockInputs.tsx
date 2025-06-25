import { KbProviderForm } from '@/features/shared/types';
import { TextInput, PasswordInput } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';

type BedrockInputsProps = {
  form: UseFormReturnType<KbProviderForm>;
};

export function AddKbProviderBedrockInputs({ form }: BedrockInputsProps) {
  return (
    <>
      <PasswordInput
        label='Access Key Id'
        placeholder='Enter an access key ID'
        {...form.getInputProps('config.accessKeyId')}
      />
      <PasswordInput
        label='Secret Access Key'
        placeholder='Enter a secret access key'
        {...form.getInputProps('config.secretAccessKey')}
      />
      <PasswordInput
        label='Session Token'
        placeholder='Enter a session token'
        {...form.getInputProps('config.sessionToken')}
      />
      <TextInput
        label='Region'
        placeholder='Enter a region'
        {...form.getInputProps('config.region')}
      />
    </>
  );
}

export function AddKbProviderBedrockWriteAccessInputs({ form }: BedrockInputsProps) {
  return (
    <>
      <TextInput
        label='Writeable Knowledge Base ID'
        description='The knowledge base used for personal document libraries'
        placeholder='Enter a knowledge base ID'
        {...form.getInputProps('config.personalDocumentLibraryKnowledgeBaseId')}
        error={form.errors['config.personalDocumentLibraryKnowledgeBaseId']}
      />
      <TextInput
        label='Data Source ID'
        description='The data source used by the knowledge base for personal document libraries'
        placeholder='Enter a data source ID'
        {...form.getInputProps('config.dataSourceId')}
        error={form.errors['config.dataSourceId']}
      />
      <TextInput
        label='S3 Bucket URI'
        description='The S3 bucket URI corresponding to the data source'
        placeholder='Enter a S3 bucket URI'
        {...form.getInputProps('config.s3BucketUri')}
        error={form.errors['config.s3BucketUri']}
      />
    </>
  );
}
