import useUpdateAiProviderModel from '@/features/settings/api/ai-providers/update-ai-provider-model';
import { ModelFormValues, modelSchema } from '@/features/shared/types';
import { ActionIcon, Group, NumberInput, TextInput } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import { Dispatch, SetStateAction, useState } from 'react';
import useTestModel from '@/features/settings/utils/useTestModel';
import { formatCurrencyNumber, parseNumber } from '@/features/shared/utils';

type EditModelFormProps = Readonly<{
  id: string;
  name: string;
  externalId: string;
  costPerMillionInputTokens: number;
  costPerMillionOutputTokens: number;
  setEditModel: Dispatch<SetStateAction<boolean>>;
}>;

export default function EditModelForm({
  id,
  name,
  externalId,
  costPerMillionInputTokens,
  costPerMillionOutputTokens,
  setEditModel,
}: EditModelFormProps) {

  const {
    mutateAsync: updateModel,
    isPending: updateModelIsPending,
    error: updateModelError,
  } = useUpdateAiProviderModel();

  const editModelForm = useForm<ModelFormValues>({
    initialValues: {
      name,
      externalId,
      costPerMillionInputTokens,
      costPerMillionOutputTokens,
    },
    validate: zodResolver(modelSchema),
  });

  const [isTestingModel, setIsTestingModel] = useState(false);

  const testModelStatus = useTestModel();

  const handleSubmit = async (values: ModelFormValues) => {
    try {
      if (editModelForm.isDirty()) {
        await updateModel({
          id,
          ...values,
        });
      }

      await testModelStatus(id, setIsTestingModel);

      handleClose();
    } catch (error) {
      notifications.show({
        id: 'edit-model-failed',
        title: 'Failed to Save Changes',
        message:
          updateModelError?.message ||
          'Unable to save your changes. Please try again later.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  const handleClose = () => {
    setEditModel(false);
    editModelForm.reset();
  };

  return (
    <form onSubmit={editModelForm.onSubmit(handleSubmit)}>
      <Group position='center'>
        <TextInput
          variant='default'
          label='Name'
          placeholder='GPT 3.5 Turbo'
          pt='sm'
          {...editModelForm.getInputProps('name')}
        />
        <TextInput
          variant='default'
          label='External ID'
          placeholder='gpt-3.5-turbo'
          pt='sm'
          {...editModelForm.getInputProps('externalId')}
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
          {...editModelForm.getInputProps('costPerMillionInputTokens')}
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
          {...editModelForm.getInputProps('costPerMillionOutputTokens')}
        />
        <ActionIcon
          type='submit'
          loading={updateModelIsPending || isTestingModel}
          aria-label='Confirm'
        >
          <IconCheck />
        </ActionIcon>
        <ActionIcon onClick={handleClose} aria-label='Cancel'>
          <IconX />
        </ActionIcon>
      </Group>
    </form>
  );
}
