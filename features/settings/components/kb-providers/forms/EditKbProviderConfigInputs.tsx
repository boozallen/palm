import { TextInput, PasswordInput, Checkbox, Tooltip } from '@mantine/core';
import { features, KbProviderForm, KbProviderType } from '@/features/shared/types';
import { UseFormReturnType } from '@mantine/form';
import { useGetFeatureFlag } from '@/features/shared/api/get-feature-flag';
import { EditKbProviderBedrockInputs, EditKbProviderBedrockWriteAccessInputs } from './EditKbProviderBedrockInputs';
import { PasswordInputPlaceholder } from '@/features/shared/components/forms/PasswordInputPlaceholder';
import { useState } from 'react';

type ProviderConfigInputsProps = Readonly<{
  form: UseFormReturnType<KbProviderForm>;
  selectedKbProvider: KbProviderType;
}>;

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

type ReplaceInputState = {
  apiKey: boolean,
}

export function EditKbProviderConfigInputs({ form, selectedKbProvider }: ProviderConfigInputsProps) {
  const { data: featureDocumentLibrary } = useGetFeatureFlag({ feature: features.DOCUMENT_LIBRARY });

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
        (<EditKbProviderBedrockWriteAccessInputs form={form} />)
      }
    </>
  );
}
