import { Dispatch, SetStateAction } from 'react';
import { Button, Group, NumberInput, Select, TextInput } from '@mantine/core';
import { IconX } from '@tabler/icons-react';

import { AiProvidersSelectInputOptions } from '@/features/shared/types';
import { parseNumber, formatCurrencyNumber } from '@/features/shared/utils';
import { useEditAiProviderForm, EditAiProviderFormValues } from '@/features/settings/hooks/useEditAiProviderForm';
import { useEditAiProviderConfig } from '@/features/settings/hooks/useEditAiProviderConfig';
import { notifications } from '@mantine/notifications';
import { EditAiProviderConfig } from '@/features/settings/components/ai-providers/forms/EditAiProviderConfig';

export type { EditAiProviderFormValues };

export type EditAiProviderFormProps = Readonly<{
  aiProviderId: string;
  initialValues: EditAiProviderFormValues;
  setFormCompleted: Dispatch<SetStateAction<boolean>>;
}>;

/**
 * Form component for editing AI provider configurations
 */
export default function EditAiProviderForm({ 
  aiProviderId, 
  initialValues, 
  setFormCompleted,
}: EditAiProviderFormProps) {
  
  const selectedAiProvider = Number(initialValues.aiProvider);
   
  // Use the form hook with the current AI provider type
  const {
    form,
    handleSubmit,
    updateAiProviderIsLoading,
  } = useEditAiProviderForm(
    aiProviderId, 
    initialValues, 
    selectedAiProvider,
  );

  // Field configuration hook
  const configProps = useEditAiProviderConfig(form, selectedAiProvider);
  
  // Form submission handler that also handles displaying notifications
  const onFormSubmit = async (values: EditAiProviderFormValues) => {
    const result = await handleSubmit(values);
    
    if (result.success) {
      handleFormCompletion();
    } else {
      notifications.show({
        id: 'update-ai-provider-failure',
        title: 'Failed to Update AI Provider',
        message: result.error?.message ?? 'There was a problem saving your changes',
        icon: <IconX />,
        variant: 'failed_operation',
      });
    }
  };

  const handleFormCompletion = () => {
    form.reset();
    setFormCompleted(true);  
  };

  return (
    <form onSubmit={form.onSubmit(onFormSubmit)}>
      <Select
        data={AiProvidersSelectInputOptions}
        placeholder='Select AI Provider'
        data-testid='select-ai-provider'
        label='AI Provider'
        disabled={true}
        {...form.getInputProps('aiProvider')}
      />
      
      <TextInput
        label='Label'
        placeholder='Enter AI Provider label'
        data-testid='input-label'
        {...form.getInputProps('label')}
      />
      
      {/* Provider-specific configuration fields */}
      <EditAiProviderConfig 
        form={form}
        {...configProps}
      />
      
      <NumberInput
        label='Input Token Cost ($/1M tokens)'
        placeholder='0.00'
        description='Set to $0.00 if you do not want to track input tokens cost.'
        precision={2}
        icon='$'
        parser={(value) => parseNumber(value)}
        formatter={(value) => formatCurrencyNumber(value)}
        hideControls
        {...form.getInputProps('inputCostPerMillionTokens')}
      />
      
      <NumberInput
        label='Output Token Cost ($/1M tokens)'
        description='Set to $0.00 if you do not want to track output tokens cost.'
        placeholder='0.00'
        precision={2}
        icon='$'
        parser={(value) => parseNumber(value)}
        formatter={(value) => formatCurrencyNumber(value)}
        hideControls
        {...form.getInputProps('outputCostPerMillionTokens')}
      />
      
      <Group spacing='lg' grow>
        <Button 
          variant='outline' 
          onClick={() => handleFormCompletion()} 
          data-testid='cancel'
        >
          Cancel
        </Button>
        <Button
          type='submit'
          data-testid='submit'
          disabled={!form.isDirty()}
          loading={updateAiProviderIsLoading}
        >
          {updateAiProviderIsLoading ? 'Saving Changes' : 'Save Changes'}
        </Button>
      </Group>
    </form>
  );
}
