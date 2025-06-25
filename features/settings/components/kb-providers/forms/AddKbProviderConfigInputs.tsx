import { TextInput, PasswordInput, Checkbox, Tooltip } from '@mantine/core';
import { AddKbProviderBedrockInputs, AddKbProviderBedrockWriteAccessInputs } from './AddKbProviderBedrockInputs';
import { features, KbProviderForm, KbProviderType } from '@/features/shared/types';
import { UseFormReturnType } from '@mantine/form';
import { useGetFeatureFlag } from '@/features/shared/api/get-feature-flag';

type ProviderConfigInputsProps = {
  form: UseFormReturnType<KbProviderForm>;
  selectedKbProvider: KbProviderType;
};

type ProviderConfig = {
  displayApiEndpoint?: boolean;
  displayApiKey?: boolean;
  displayWriteAccess?: boolean;
  displayBedrockInput?: boolean;
};

function getProviderConfig(selectedKbProvider: KbProviderType) {
  const providerInputConfig: Record<number, ProviderConfig> = {
    [KbProviderType.KbProviderPalm]: {
      displayApiEndpoint: true,
      displayApiKey: true,
      displayWriteAccess: true,
    },
    [KbProviderType.KbProviderBedrock]: {
      displayBedrockInput: true,
      displayWriteAccess: true,
    },
  };
  return providerInputConfig[selectedKbProvider] || {};
}

export function AddKbProviderConfigInputs({ form, selectedKbProvider }: ProviderConfigInputsProps) {
  const { data: featureDocumentLibrary } = useGetFeatureFlag({ feature: features.DOCUMENT_LIBRARY });

  const providerConfig = getProviderConfig(selectedKbProvider);

  return (
    <>
      {providerConfig.displayBedrockInput && <AddKbProviderBedrockInputs form={form} />}
      {providerConfig.displayApiEndpoint && (
        <TextInput
          label='API Endpoint'
          placeholder='Enter an API endpoint'
          {...form.getInputProps('config.apiEndpoint')}
        />
      )}
      {providerConfig.displayApiKey && (
        <PasswordInput
          label='API Key'
          placeholder='Enter an API key'
          {...form.getInputProps('config.apiKey')}
        />
      )}
      {providerConfig.displayWriteAccess && featureDocumentLibrary?.isFeatureOn && (
        <Tooltip label='Provider supports personal document library functionality'>
          <Checkbox
            label='Write Access'
            pb='md'
            {...form.getInputProps('writeAccess', { type: 'checkbox' })}
          />
        </Tooltip>
      )}
      {form.values.writeAccess &&
        selectedKbProvider === KbProviderType.KbProviderBedrock &&
        (<AddKbProviderBedrockWriteAccessInputs form={form} />)
      }
    </>
  );
}
