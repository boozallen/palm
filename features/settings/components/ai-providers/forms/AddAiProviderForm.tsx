import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { Button, Group, NumberInput, PasswordInput, Select, TextInput } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { AiProviderType, AiProvidersSelectInputOptions, generateConditionalAiProviderSchema } from '@/features/shared/types';
import useAddAiProvider from '@/features/settings/api/add-ai-provider';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { formatCurrencyNumber, parseNumber } from '@/features/shared/utils';

export type AddAiProviderFormProps = Readonly<{ setFormCompleted: Dispatch<SetStateAction<boolean>>; }>;

type AiProviderFormValues = {
  aiProvider: number;
  label: string;
  apiKey: string;
  apiEndpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  region: string;
  inputCostPerMillionTokens?: number;
  outputCostPerMillionTokens?: number;
};

export default function AddAiProviderForm({ setFormCompleted }: AddAiProviderFormProps) {

  let selectData = AiProvidersSelectInputOptions;

  const { mutateAsync: addAiProvider, isPending: addAiProviderIsPending, error: addAiProviderError } = useAddAiProvider();

  const [selectedAiProvider, setSelectedAiProvider] = useState<number>(0);

  const addAiProviderForm = useForm<AiProviderFormValues>({
    initialValues: {
      aiProvider: 0,
      label: '',
      apiKey: '',
      apiEndpoint: '',
      accessKeyId: '',
      secretAccessKey: '',
      sessionToken: '',
      region: '',
      inputCostPerMillionTokens: undefined,
      outputCostPerMillionTokens: undefined,
    },
    validate: zodResolver(
      generateConditionalAiProviderSchema(selectData.find(data => data.value == String(selectedAiProvider)) ?? { label: '', value: '' })
    ),
  });

  useEffect(() => {
    const aiProviderNumber = Number(addAiProviderForm.values.aiProvider);

    if (!isNaN(aiProviderNumber)) {
      setSelectedAiProvider(aiProviderNumber);
    }
  }, [addAiProviderForm.values.aiProvider]);

  const displayInputApiEndpoint =
    selectedAiProvider == AiProviderType.AzureOpenAi;
  const displayInputApiKey =
    selectedAiProvider == AiProviderType.OpenAi ||
    selectedAiProvider == AiProviderType.AzureOpenAi ||
    selectedAiProvider == AiProviderType.Anthropic ||
    selectedAiProvider == AiProviderType.Gemini;
  const displayAwsFields = selectedAiProvider == AiProviderType.Bedrock;

  const handleSubmit = async (values: AiProviderFormValues) => {
    const newProvider = {
      label: values.label,
      type: Number(values.aiProvider) as AiProviderType,
      apiKey: values.apiKey,
      apiEndpoint: values.apiEndpoint,
      accessKeyId: values.accessKeyId,
      secretAccessKey: values.secretAccessKey,
      sessionToken: values.sessionToken,
      region: values.region,
      inputCostPerMillionTokens: values.inputCostPerMillionTokens,
      outputCostPerMillionTokens: values.outputCostPerMillionTokens,
    };

    try {
      await addAiProvider(newProvider);
      handleFormCompletion();
    } catch (error) {
      notifications.show({
        title: 'Add AI Provider Failed',
        message: addAiProviderError?.message ?? 'There was a problem adding the AI provider',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    }
  };

  function handleFormCompletion() {
    addAiProviderForm.reset();
    setFormCompleted(true);
  }

  return (
    <form onSubmit={addAiProviderForm.onSubmit(handleSubmit)}>
      <Select
        data={selectData}
        placeholder='Select AI Provider'
        data-testid='AI Provider'
        label='AI Provider'
        withinPortal={true}
        {...addAiProviderForm.getInputProps('aiProvider')}
      />
      <TextInput
        label='Label'
        placeholder='Label your new AI provider'
        data-testid='Label'
        {...addAiProviderForm.getInputProps('label')}
      />
      {/* AI provider configurations */}
      {displayInputApiEndpoint && (
        <TextInput
          label='API Endpoint'
          placeholder='API Endpoint here'
          data-testid='API Endpoint'
          {...addAiProviderForm.getInputProps('apiEndpoint')}
        />
      )}
      {displayInputApiKey && (
        <PasswordInput
          label='API Key'
          placeholder={'API Key here'}
          data-testid='API Key'
          {...addAiProviderForm.getInputProps('apiKey')}
        />
      )}

      {displayAwsFields && (
        <>
          <PasswordInput
            label='Access Key ID'
            placeholder='Access Key ID here'
            {...addAiProviderForm.getInputProps('accessKeyId')}
          />

          <PasswordInput
            label='Secret Access Key'
            placeholder='Secret Access Key here'
            {...addAiProviderForm.getInputProps('secretAccessKey')}
          />

          <PasswordInput
            label='Session Token'
            placeholder='Session Token here'
            {...addAiProviderForm.getInputProps('sessionToken')}
          />

          <TextInput
            label='Region'
            placeholder='Region here'
            {...addAiProviderForm.getInputProps('region')}
          />
        </>
      )}

      <NumberInput
        label='Input Token Cost ($/1M tokens)'
        placeholder='0.00'
        description='Leave blank if you do not want to track input tokens cost.'
        precision={2}
        icon='$'
        parser={(value) => parseNumber(value)}
        formatter={(value) => formatCurrencyNumber(value)}
        hideControls
        {...addAiProviderForm.getInputProps('inputCostPerMillionTokens')}
      />
      <NumberInput
        label='Output Token Cost ($/1M tokens)'
        description='Leave blank if you do not want to track output tokens cost.'
        placeholder='0.00'
        precision={2}
        icon='$'
        parser={(value) => parseNumber(value)}
        formatter={(value) => formatCurrencyNumber(value)}
        hideControls
        {...addAiProviderForm.getInputProps('outputCostPerMillionTokens')}
      />
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={handleFormCompletion}>
          Cancel
        </Button>
        <Button
          type='submit'
          data-testid='submit'
          loading={addAiProviderIsPending}>
          {addAiProviderIsPending ? 'Adding AI Provider' : 'Add AI Provider'}
        </Button>
      </Group>
    </form>
  );
}
