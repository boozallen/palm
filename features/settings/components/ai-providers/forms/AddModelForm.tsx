import useAddAiProviderModel from '@/features/settings/api/ai-providers/add-ai-provider-model';
import { ModelFormValues, modelSchema } from '@/features/shared/types';
import {
  ActionIcon,
  Checkbox,
  Group,
  NumberInput,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import { TRPCClientError } from '@trpc/client';
import { Dispatch, SetStateAction, useState } from 'react';
import { ShowModelRowType } from '@/features/settings/components/ai-providers/tables/AiProvidersTableBody';
import useTestModel from '@/features/settings/utils/useTestModel';
import { formatCurrencyNumber, parseNumber } from '@/features/shared/utils';

/**
 * The route rejects a second embeddings-only model on one provider as a CONFLICT,
 * with a message naming the one that already holds the designation. That message
 * is the only thing that tells the admin which row to delete, so it is passed
 * through instead of sanitized. The code is checked rather than the message
 * because the DAL's error class does not survive tRPC serialization.
 */
function isDuplicateEmbeddingsModelError(
  error: unknown,
): error is TRPCClientError<never> {
  return error instanceof TRPCClientError && error.data?.code === 'CONFLICT';
}

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
      embeddingsOnly: false,
    },
    validate: zodResolver(modelSchema),
  });

  const [isTestingModel, setIsTestingModel] = useState(false);

  const testModelStatus = useTestModel();

  const handleSubmit = async (values: ModelFormValues) => {
    try {
      const result = await addModel({
        ...values,
        name: values.name.trim(),
        externalId: values.externalId.trim(),
        aiProviderId: providerId,
      });

      // The test sends a chat completion, which an embedding model cannot serve:
      // it would fail and blame the admin's credentials for a correct config.
      if (values.embeddingsOnly) {
        handleClose();

        return;
      }

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
          // Only the one-per-provider rejection is shown as-is: it names the model
          // already designated, which is what tells the admin what to fix. Every
          // other failure keeps the generic copy.
          (isDuplicateEmbeddingsModelError(error)
            ? error.message
            : null) ||
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
          placeholder='GPT 4o'
          pt='sm'
          {...addModelForm.getInputProps('name')}
        />
        <TextInput
          variant='default'
          label='External ID'
          placeholder='gpt-4o'
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
        <Tooltip
          label='Use this model for embeddings instead of chat. One per provider; embeddings-only models are hidden from the chat and system model selects.'
          openDelay={600}
          events={{ hover: true, focus: true, touch: true }}
          multiline
          w={260}
        >
          <Checkbox
            label='Embeddings only'
            pt='sm'
            data-testid='add-model-embeddings-only'
            {...addModelForm.getInputProps('embeddingsOnly', {
              type: 'checkbox',
            })}
          />
        </Tooltip>
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
