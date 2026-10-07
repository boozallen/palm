import { TextInput, PasswordInput } from '@mantine/core';
import { AddKbProviderBedrockInputs } from './AddKbProviderBedrockInputs';
import { KbProviderForm, KbProviderType } from '@/features/shared/types';
import { UseFormReturnType } from '@mantine/form';

type ProviderConfigInputsProps = {
  form: UseFormReturnType<KbProviderForm>;
  selectedKbProvider: KbProviderType;
};

type ProviderConfig = {
  displayApiEndpoint?: boolean;
  displayApiKey?: boolean;
  displayBedrockInput?: boolean;
};

function getProviderConfig(selectedKbProvider: KbProviderType) {
  const providerInputConfig: Record<number, ProviderConfig> = {
    [KbProviderType.KbProviderPalm]: {
      displayApiEndpoint: true,
      displayApiKey: true,
    },
    [KbProviderType.KbProviderBedrock]: {
      displayBedrockInput: true,
    },
  };
  return providerInputConfig[selectedKbProvider] || {};
}

export function AddKbProviderConfigInputs({ form, selectedKbProvider }: ProviderConfigInputsProps) {

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
    </>
  );
}
