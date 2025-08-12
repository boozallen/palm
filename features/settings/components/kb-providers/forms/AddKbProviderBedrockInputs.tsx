import { TextInput, PasswordInput } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';

import { KbProviderForm } from '@/features/shared/types';
import CloudRequirementsBanner from '@/features/settings/components/shared/elements/CloudRequirementsBanner';

type BedrockInputsProps = {
  form: UseFormReturnType<KbProviderForm>;
};

export function AddKbProviderBedrockInputs({ form }: BedrockInputsProps) {
  return (
    <>
      <PasswordInput
        label='Access Key Id'
        description='Leave blank to inherit AWS_ACCESS_KEY_ID environment variable'
        placeholder='Enter an access key ID'
        {...form.getInputProps('config.accessKeyId')}
      />
      <PasswordInput
        label='Secret Access Key'
        description='Leave blank to inherit AWS_SECRET_ACCESS_KEY environment variable'
        placeholder='Enter a secret access key'
        {...form.getInputProps('config.secretAccessKey')}
      />
      <PasswordInput
        label='Session Token'
        description='Leave blank to inherit AWS_SESSION_TOKEN environment variable'
        placeholder='Enter a session token'
        {...form.getInputProps('config.sessionToken')}
      />
      <TextInput
        label='Region'
        description='Leave blank to inherit AWS_REGION environment variable'
        placeholder='Enter a region'
        {...form.getInputProps('config.region')}
      />
      <CloudRequirementsBanner service='bedrock' />
    </>
  );
}
