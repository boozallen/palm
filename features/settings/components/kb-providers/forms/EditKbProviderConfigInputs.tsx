import { TextInput, PasswordInput } from '@mantine/core';
import { useState } from 'react';
import { UseFormReturnType } from '@mantine/form';

import { KbProviderForm, KbProviderType } from '@/features/shared/types';
import { EditKbProviderBedrockInputs } from './EditKbProviderBedrockInputs';
import { PasswordInputPlaceholder } from '@/features/shared/components/forms/PasswordInputPlaceholder';

type ProviderConfigInputsProps = Readonly<{
  form: UseFormReturnType<KbProviderForm>;
  selectedKbProvider: KbProviderType;
}>;

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

type ReplaceInputState = {
  apiKey: boolean,
}

export function EditKbProviderConfigInputs({ form, selectedKbProvider }: ProviderConfigInputsProps) {
  const providerConfig = getProviderConfig(selectedKbProvider);

  const [replaceInput, setReplaceInput] = useState({
    apiKey: false,
  });

  const handleReplace = (id: keyof ReplaceInputState) => {
    // toggle the state of specific input fields
    setReplaceInput((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));

    switch (id) {
      case 'apiKey':
        form.setFieldValue('config.apiKey', '');
        break;
    }
  };

  return (
    <>
      {providerConfig.displayBedrockInput && <EditKbProviderBedrockInputs form={form} />}
      {providerConfig.displayApiEndpoint && (
        <TextInput
          label='API Endpoint'
          placeholder='Enter an API endpoint'
          {...form.getInputProps('config.apiEndpoint')}
        />
      )}
      {providerConfig.displayApiKey && (
        !replaceInput.apiKey ?
          <PasswordInputPlaceholder handleReplace={() => handleReplace('apiKey')} /> :
          <PasswordInput
            label='API Key'
            placeholder='Enter an API key'
            autoFocus
            {...form.getInputProps('config.apiKey')}
          />
      )}
    </>
  );
}
