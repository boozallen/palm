import useAddAiProviderModel from '@/features/settings/api/ai-providers/add-ai-provider-model';
import { ModelFormValues, modelSchema } from '@/features/shared/types';
import { ActionIcon, Group, NumberInput, TextInput } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import { Dispatch, SetStateAction, useState } from 'react';
import { ShowModelRowType } from '@/features/settings/components/ai-providers/tables/AiProvidersTableBody';
import useTestModel from '@/features/settings/utils/useTestModel';
import { formatCurrencyNumber, parseNumber } from '@/features/shared/utils';

type AddModelFormProps = Readonly<{
  providerId: string;
  setShowAddModelRow: Dispatch<SetStateAction<ShowModelRowType>>;
  setNewModelBeingTested: Dispatch<SetStateAction<string | null>>;
}>;

export default function AddModelForm({
  providerId,
  setShowAddModelRow,
  setNewModelBeingTested,
}: AddModelFormProps) {

  const {
    mutateAsync: addModel,
    isPending: addModelIsPending,
    error: addModelError,
  } = useAddAiProviderModel();

  const addModelForm = useForm<ModelFormValues>({
    initialValues: {
      name: '',
      externalId: '',
      costPerMillionInputTokens: 0,
      costPerMillionOutputTokens: 0,
    },
    validate: zodResolver(modelSchema),
  });

  const [isTestingModel, setIsTestingModel] = useState(false);

  const testModelStatus = useTestModel();

  const handleSubmit = async (values: ModelFormValues) => {
    try {
      const result = await addModel({
        ...values,
        aiProviderId: providerId,
      });

      setIsTestingModel(true);
      setNewModelBeingTested(result.id);

      await testModelStatus(result.id, (isPending) => {
        setIsTestingModel(isPending);
        if (!isPending) {
          setNewModelBeingTested(null);
          handleClose();
        }
      });
    } catch (error) {
      notifications.show({
        id: 'add-model-failed',
        title: 'Failed to Create Model',
        message:
          addModelError?.message ||
          'Unable to create model. Please try again later.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  const handleClose = () => {
    setShowAddModelRow({ show: false, providerId: '' });
    addModelForm.reset();
  };

  return (
    <form onSubmit={addModelForm.onSubmit(handleSubmit)}>
      <Group position='center'>
        <TextInput
          variant='default'
          label='Name'
          placeholder='GPT 3.5 Turbo'
          pt='sm'
          {...addModelForm.getInputProps('name')}
        />
        <TextInput
          variant='default'
          label='External ID'
          placeholder='gpt-3.5-turbo'
          pt='sm'
          {...addModelForm.getInputProps('externalId')}
        />
        <NumberInput
          variant='default'
          label='Input Token Cost ($/1M tokens)'
          placeholder='0.00'
          description='Leave blank if you do not want to track input tokens cost.'
          precision={2}
          icon='$'
          parser={(value) => parseNumber(value)}
          formatter={(value) => formatCurrencyNumber(value)}
          hideControls
          {...addModelForm.getInputProps('costPerMillionInputTokens')}
        />
        <NumberInput
          variant='default'
          label='Output Token Cost ($/1M tokens)'
          description='Leave blank if you do not want to track output tokens cost.'
          placeholder='0.00'
          precision={2}
          icon='$'
          parser={(value) => parseNumber(value)}
          formatter={(value) => formatCurrencyNumber(value)}
          hideControls
          {...addModelForm.getInputProps('costPerMillionOutputTokens')}
        />
        <ActionIcon type='submit' loading={addModelIsPending || isTestingModel}>
          <IconCheck />
        </ActionIcon>
        <ActionIcon onClick={handleClose} disabled={isTestingModel}>
          <IconX />
        </ActionIcon>
      </Group>
    </form>
  );
}
