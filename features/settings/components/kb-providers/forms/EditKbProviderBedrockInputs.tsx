import { PasswordInputPlaceholder } from '@/features/shared/components/forms/PasswordInputPlaceholder';
import { KbProviderForm } from '@/features/shared/types';
import { TextInput, PasswordInput } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { useState } from 'react';

type BedrockInputsProps = Readonly<{
  form: UseFormReturnType<KbProviderForm>;
}>;

type ReplaceInputState = {
  accessKeyId: boolean,
  secretAccessKey: boolean,
  sessionToken: boolean,
}

export function EditKbProviderBedrockInputs({ form }: BedrockInputsProps) {
  const [replaceInput, setReplaceInput] = useState({
    accessKeyId: false,
    secretAccessKey: false,
    sessionToken: false,
  });

  const handleReplace = (id: keyof ReplaceInputState) => {
    // toggle the state of specific input fields
    setReplaceInput((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));

    switch (id) {
      case 'accessKeyId':
        form.setFieldValue('config.accessKeyId', '');
        break;
      case 'secretAccessKey':
        form.setFieldValue('config.secretAccessKey', '');
        break;
      case 'sessionToken':
        form.setFieldValue('config.sessionToken', '');
        break;
    }
  };

  return (
    <>
      {!replaceInput.accessKeyId ?
        <PasswordInputPlaceholder
          handleReplace={() => handleReplace('accessKeyId')}
          label='Access Key Id'
        /> :
        <PasswordInput
          label='Access Key Id'
          placeholder='Enter an access key ID'
          {...form.getInputProps('config.accessKeyId')}
        />
      }

      {!replaceInput.secretAccessKey ?
        <PasswordInputPlaceholder
          handleReplace={() => handleReplace('secretAccessKey')}
          label='Secret Access Key'
        /> :
        <PasswordInput
          label='Secret Access Key'
          placeholder='Enter a secret access key'
          {...form.getInputProps('config.secretAccessKey')}
        />
      }

      {!replaceInput.sessionToken ?
        <PasswordInputPlaceholder
          handleReplace={() => handleReplace('sessionToken')}
          label='Session Token'
        /> :
        <PasswordInput
          label='Session Token'
          placeholder='Enter a session token'
          {...form.getInputProps('config.sessionToken')}
        />
      }

      <TextInput
        label='Region'
        placeholder='Enter a region'
        {...form.getInputProps('config.region')}
      />
    </>
  );
}

export function EditKbProviderBedrockWriteAccessInputs({ form }: BedrockInputsProps) {
  return (
    <>
      <TextInput
        label='Writeable Knowledge Base ID'
        placeholder='Enter knowledge base ID for personal document libraries'
        {...form.getInputProps('config.personalDocumentLibraryKnowledgeBaseId')}
        error={form.errors['config.personalDocumentLibraryKnowledgeBaseId']}
      />
      <TextInput
        label='Data Source ID'
        placeholder='Enter data source ID used by the knowledge base'
        {...form.getInputProps('config.dataSourceId')}
        error={form.errors['config.dataSourceId']}
      />
      <TextInput
        label='S3 Bucket URI'
        placeholder='Enter S3 bucket URI corresponding to the data source'
        {...form.getInputProps('config.s3BucketUri')}
        error={form.errors['config.s3BucketUri']}
      />
    </>
  );
}
