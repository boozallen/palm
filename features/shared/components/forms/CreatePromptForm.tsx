import { IconCheck, IconX } from '@tabler/icons-react';
import {
  Button,
  Grid,
  Group,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/router';

import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import {
  newPrompt,
  PromptFormValues,
  PromptSchema,
} from '@/features/shared/types';
import { useCreatePrompt } from '@/features/shared/api/create-prompt';
import { ViewPromptMessage } from '@/features/shared/components/notifications';
import Loading from '@/features/shared/components/Loading';
import PromptTagsSelectAndSuggestions from './inputs/PromptTagsSelectAndSuggestions';
import ModelSelect from './inputs/ModelSelect';
import AiConfigSlider from './inputs/AiConfigSlider';

type CreatePromptFormProps = Readonly<{
  prompt?: Partial<PromptFormValues>;
}>;

export default function CreatePromptForm({ prompt }: CreatePromptFormProps) {
  const { mutate: createPrompt, isPending: createPromptIsPending } =
    useCreatePrompt();
  const { data: systemConfig, isPending: systemConfigPending } =
    useGetSystemConfig();

  const router = useRouter();

  const createPromptForm = useForm<PromptFormValues>({
    initialValues: newPrompt({
      ...prompt,
      title: '',
    }),
    validate: zodResolver(PromptSchema),
  });

  if (systemConfigPending) {
    return <Loading />;
  }

  function handleSubmit(values: PromptFormValues) {
    createPrompt({ prompt: values },
      {
        onSuccess: (data) => {
          if (router.query.fromLibrary === 'true') {
            notifications.show({
              id: 'create_prompt',
              title: 'Prompt Created',
              message: 'You have successfully created a new prompt.',
              icon: <IconCheck />,
              autoClose: true,
              variant: 'successful_operation',
            });

            const titleSlug = values.title.toLowerCase().replace(/\s+/g, '-');

            router.push(`/library/${titleSlug}/${data.prompt.id}`);
          } else {
            notifications.show({
              id: 'create_prompt',
              title: 'Prompt Created',
              message: (
                <ViewPromptMessage
                  title={values.title}
                  promptId={data.prompt.id}
                  notificationId='create_prompt'
                />
              ),
              icon: <IconCheck />,
              autoClose: false,
              variant: 'successful_operation',
            });

            router.back();
          }
        },
        onError: (error) => {
          notifications.show({
            id: 'create_prompt',
            title: 'Failed to Create Prompt',
            message:
              error.message ||
              'Could not create prompt. Please try again later.',
            icon: <IconX />,
            variant: 'failed_operation',
            autoClose: false,
            withCloseButton: true,
          });
        },
      }
    );
  }

  const handleCancel = () => {
    const { promptData, fromPlayground, fromLibrary } = router.query;

    if (fromPlayground === 'true' && promptData) {
      router.push({
        pathname: '/prompt-playground',
        query: { returnedPromptData: promptData },
      });
    } else if (fromLibrary === 'true' && promptData) {
      const originalPath = router.query.originalPath as string;
      if (originalPath && typeof originalPath === 'string') {
        router.push({
          pathname: originalPath,
          query: { returnedPromptData: promptData },
        });
      } else {
        router.back();
      }
    } else {
      router.back();
    }
  };

  return (
    <form onSubmit={createPromptForm.onSubmit(handleSubmit)}>
      <TextInput
        label='Title'
        placeholder='Title here'
        data-autofocus
        {...createPromptForm.getInputProps('title')}
      />
      <TextInput
        label='Summary'
        placeholder='Summary here'
        {...createPromptForm.getInputProps('summary')}
      />
      <Textarea
        label='Description'
        placeholder='Description here'
        autosize
        minRows={5}
        maxRows={5}
        {...createPromptForm.getInputProps('description')}
      />
      <Textarea
        label='Example'
        description='Enter an example such as text or a code snippet that illustrates the expected input'
        placeholder='Example here'
        autosize
        minRows={5}
        maxRows={5}
        {...createPromptForm.getInputProps('example')}
      />
      <Textarea
        label='Instructions'
        description='Provide clear, detailed instructions on how the AI should interpret and process the given input'
        placeholder='Instructions here'
        autosize
        minRows={5}
        maxRows={5}
        {...createPromptForm.getInputProps('instructions')}
      />
      <Grid>
        <Grid.Col span={6}>
          <AiConfigSlider
            label='Randomness'
            description='How creative the AI can be'
            {...createPromptForm.getInputProps('config.randomness')}
          />
          <AiConfigSlider
            label='Repetitiveness'
            description='How repetitive the AI can be'
            {...createPromptForm.getInputProps('config.repetitiveness')}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <ModelSelect
            setValue={v => createPromptForm.setFieldValue('config.model', v)}
            {...createPromptForm.getInputProps('config.model')}
          />
        </Grid.Col>
      </Grid>

      <PromptTagsSelectAndSuggestions
        form={createPromptForm}
        promptTagSuggestionsEnabled={systemConfig?.featureManagementPromptTagSuggestions ?? false}
      />
      <Group mt='md' spacing='md'>
        <Button
          type='submit'
          data-testid='submit'
          loading={createPromptIsPending}
        >
          Create Prompt
        </Button>
        <Button variant='outline' onClick={handleCancel}>
          Cancel
        </Button>
      </Group>
    </form>
  );
}
