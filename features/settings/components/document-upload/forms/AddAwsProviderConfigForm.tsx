import { PasswordInput, TextInput } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
 
import { AddProviderForm } from '@/features/shared/types';
import CloudRequirementsBanner from '@/features/settings/components/shared/elements/CloudRequirementsBanner';

type AddAwsProviderFormProps = {
  form: UseFormReturnType<AddProviderForm>;
}
export default function AddAwsProviderConfigForm({
  form,
}: AddAwsProviderFormProps) {
  return (
    <>
      <PasswordInput
        label='Access Key ID'
        description='Leave blank to inherit AWS_ACCESS_KEY_ID environment variable'
        placeholder='Enter access key ID'
        {...form.getInputProps('config.accessKeyId')}
      />
      <PasswordInput
        label='Secret Access Key'
        description='Leave blank to inherit AWS_SECRET_ACCESS_KEY environment variable'
        placeholder='Enter secret access key'
        {...form.getInputProps('config.secretAccessKey')}
      />
      <PasswordInput
        label='Session Token'
        description='Leave blank to inherit AWS_SESSION_TOKEN environment variable'
        placeholder='Enter session token'
        {...form.getInputProps('config.sessionToken')}
      />
      <TextInput
        label='Region'
        description='Leave blank to inherit AWS_REGION environment variable'
        placeholder='Enter region'
        {...form.getInputProps('config.region')}
      />
      <TextInput
        label='S3 URI'
        placeholder='Enter S3 URI'
        {...form.getInputProps('config.s3Uri')}
      />
      <CloudRequirementsBanner service='s3' />
    </>
  );
}
