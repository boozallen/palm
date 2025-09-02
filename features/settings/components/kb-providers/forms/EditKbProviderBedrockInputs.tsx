import { useState } from 'react';
import { TextInput, PasswordInput } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';

import { PasswordInputPlaceholder } from '@/features/shared/components/forms/PasswordInputPlaceholder';
import { KbProviderForm } from '@/features/shared/types';
import CloudRequirementsBanner from '@/features/settings/components/shared/elements/CloudRequirementsBanner';

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

      <CloudRequirementsBanner service='bedrock' />
    </>
  );
}
