import { PasswordInput, TextInput } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { PasswordInputPlaceholder } from '@/features/shared/components/forms/PasswordInputPlaceholder';
import { EditAiProviderFormValues } from '@/features/settings/hooks/useEditAiProviderForm';

type EditAiProviderConfigProps = Readonly<{
  form: UseFormReturnType<EditAiProviderFormValues>;
  displayInputApiEndpoint: boolean;
  displayInputApiKey: boolean;
  displayAwsFields: boolean;
  replaceApiKey: boolean;
  replaceAwsFields: {
    accessKeyId: boolean;
    secretAccessKey: boolean;
    sessionToken: boolean;
  };
  handleReplace: (field?: string) => void;
}>;

/**
 * Component to render provider-specific configuration fields
 * based on the selected AI provider type
 */
export function EditAiProviderConfig({
  form,
  displayInputApiEndpoint,
  displayInputApiKey,
  displayAwsFields,
  replaceApiKey,
  replaceAwsFields,
  handleReplace,
}: EditAiProviderConfigProps) {
  return (
    <>
      {displayInputApiEndpoint && (
        <TextInput
          label='API Endpoint'
          placeholder='API Endpoint here'
          data-testid='input-api-endpoint'
          {...form.getInputProps('apiEndpoint')}
        />
      )}
      
      {displayInputApiKey && (
        !replaceApiKey ?
          <PasswordInputPlaceholder handleReplace={handleReplace} /> :
          <PasswordInput
            label='API Key'
            placeholder='API Key here'
            data-testid='input-api-key'
            autoFocus
            {...form.getInputProps('apiKey')}
          />
      )}
      
      {displayAwsFields && (
        <>
          {!replaceAwsFields.accessKeyId ?
            <PasswordInputPlaceholder
              handleReplace={() => handleReplace('accessKeyId')}
              label='Access Key ID'
            /> :
            <PasswordInput
              label='Access Key ID'
              placeholder='Access Key ID here'
              {...form.getInputProps('accessKeyId')}
            />
          }

          {!replaceAwsFields.secretAccessKey ?
            <PasswordInputPlaceholder
              handleReplace={() => handleReplace('secretAccessKey')}
              label='Secret Access Key'
            /> :
            <PasswordInput
              label='Secret Access Key'
              placeholder='Secret Access Key here'
              {...form.getInputProps('secretAccessKey')}
            />
          }

          {!replaceAwsFields.sessionToken ?
            <PasswordInputPlaceholder
              handleReplace={() => handleReplace('sessionToken')}
              label='Session Token'
            /> :
            <PasswordInput
              label='Session Token'
              placeholder='Session Token here'
              {...form.getInputProps('sessionToken')}
            />
          }

          <TextInput
            label='Region'
            placeholder='Region here'
            {...form.getInputProps('region')}
          />
        </>
      )}
    </>
  );
}
