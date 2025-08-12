import { useForm, zodResolver } from '@mantine/form';
import { IconCheck, IconInfoCircle, IconX } from '@tabler/icons-react';
import {
  Button,
  Grid,
  Group,
  Select,
  Slider,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';

import useUpdatePrompt from '@/features/library/api/update-prompt';
import { newPrompt, Prompt, PromptFormValues, PromptSchema } from '@/features/shared/types';
import { useGetAiProviderModelSelectData } from '@/features/shared/data/ai-provider-model-select-data';
import { ViewPromptMessage } from '@/features/shared/components/notifications';
import Loading from '@/features/shared/components/Loading';
import PromptTagSuggestionIcon from '@/features/shared/components/elements/PromptTagSuggestionIcon';
import PromptTagSuggestionContainer from '@/features/shared/components/forms/inputs/PromptTagSuggestionContainer';
import PromptTagsMultiSelect from '@/features/shared/components/forms/inputs/PromptTagsMultiSelect';
import useGetPromptTagSuggestions from '@/features/shared/api/get-prompt-tag-suggestions';
import { useState } from 'react';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';

type EditPromptFormProps = Readonly<{
  prompt: Prompt;
}>;

export default function EditPromptForm({ prompt }: EditPromptFormProps) {

  const {
    mutate: updatePrompt,
    isPending: updatePromptIsPending,
  } = useUpdatePrompt();

  const editPromptForm = useForm<PromptFormValues>({
    initialValues: newPrompt(prompt),
    validate: zodResolver(PromptSchema),
  });

  const { modelOptions } = useGetAiProviderModelSelectData();

  const { mutate: promptTagSuggestions, isPending: promptTagSuggestionsIsPending } =
    useGetPromptTagSuggestions();

  const { data: systemConfig, isPending: systemConfigPending } = useGetSystemConfig();

  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [suggestionContainerIsOpen, setSuggestionContainerIsOpen] = useState(false);

  if (systemConfigPending) {
    return <Loading />;
  }

  const getPromptTagSuggestions = (values: PromptFormValues) => {
    editPromptForm.validate();
    if (editPromptForm.isValid()) {
      promptTagSuggestions({ prompt: values }, {
        onSuccess: (data) => {
          setSuggestedTags(data.tags);
          setSuggestionContainerIsOpen(true);
        },
        onError: (error) => {
          notifications.show({
            id: 'get_prompt_tag_suggestions',
            title: 'Failed to Get Suggested Prompt Tags',
            message: error.message || 'Could not get suggested prompt tags. Please try again later.',
            icon: <IconX />,
            variant: 'failed_operation',
            autoClose: false,
            withCloseButton: true,
          });
        },
      });
    }
  };

  const handleSubmit = (values: PromptFormValues) => {
    updatePrompt({
      title: values.title,
      summary: values.summary,
      description: values.description,
      instructions: values.instructions,
      example: values.example,
      model: values.config.model,
      randomness: values.config.randomness,
      repetitiveness: values.config.repetitiveness,
      tags: values.tags,
      id: prompt.id,
    }, {
      onSuccess: (data) => {
        notifications.show({
          id: 'update_prompt',
          title: 'Prompt Updated',
          message: <ViewPromptMessage promptId={data.id} title={data.title} notificationId={'update_prompt'} />,
          icon: <IconCheck />,
          autoClose: true,
          variant: 'successful_operation',
        });
        editPromptForm.resetDirty();
      },
      onError: (error) => {
        notifications.show({
          id: 'update-prompt',
          title: 'Failed to Update Prompt',
          message: error.message || 'Unable to save your changes. Please try again later.',
          autoClose: false,
          withCloseButton: true,
          icon: <IconX />,
          variant: 'failed_operation',
        });
      },
    });
  };

  return (
    <form onSubmit={editPromptForm.onSubmit(handleSubmit)}>
      <TextInput
        label='Title'
        placeholder='Title here'
        {...editPromptForm.getInputProps('title')}
      />
      <TextInput
        label='Summary'
        placeholder='Summary here'
        {...editPromptForm.getInputProps('summary')}
      />
      <Textarea
        label='Description'
        placeholder='Description here'
        autosize
        minRows={5}
        {...editPromptForm.getInputProps('description')}
      />
      <Textarea
        label='Example'
        description='Enter an example such as text or a code snippet that illustrates the expected input'
        placeholder='Example here'
        autosize
        minRows={5}
        {...editPromptForm.getInputProps('example')}
      />
      <Textarea
        label='Instructions'
        description='Provide clear, detailed instructions on how the AI should interpret and process the given input'
        placeholder='Instructions here'
        autosize
        minRows={5}
        {...editPromptForm.getInputProps('instructions')}
      />
      <Grid>
        <Grid.Col span={6}>
          <Group spacing='xs'>
            <Text variant='slider_label'>
              {`Randomness (${editPromptForm.values.config.randomness})`}
            </Text>
            <Tooltip label='How creative the AI can be'>
              <ThemeIcon size='xs'>
                <IconInfoCircle />
              </ThemeIcon>
            </Tooltip>
          </Group>
          <Slider
            thumbLabel='Randomness'
            {...editPromptForm.getInputProps('config.randomness')}
          />
          <Group spacing='xs'>
            <Text variant='slider_label'>
              {`Repetitiveness (${editPromptForm.values.config.repetitiveness})`}
            </Text>
            <Tooltip label='How repetitive the AI can be'>
              <ThemeIcon size='xs'>
                <IconInfoCircle />
              </ThemeIcon>
            </Tooltip>
          </Group>
          <Slider
            thumbLabel='Repetitiveness'
            {...editPromptForm.getInputProps('config.repetitiveness')}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <Select
            label='Language model'
            nothingFound='No large language models available'
            data={modelOptions}
            {...editPromptForm.getInputProps('config.model')}
          />
        </Grid.Col>
      </Grid>
      <Group mb='md' align='end'>
        <PromptTagsMultiSelect form={editPromptForm} />
        {systemConfig?.featureManagementPromptTagSuggestions &&
          <PromptTagSuggestionIcon
            enabled={!Object.keys(editPromptForm.errors).length}
            isLoading={promptTagSuggestionsIsPending}
            onClick={() => getPromptTagSuggestions(editPromptForm.values)}
          />
        }
      </Group>
      {suggestionContainerIsOpen && !promptTagSuggestionsIsPending && (
        <PromptTagSuggestionContainer
          tags={suggestedTags}
          onAccept={(tags) => editPromptForm.setFieldValue('tags', tags)}
          onClose={() => setSuggestionContainerIsOpen(false)}
        />
      )}
      <Button
        type='submit'
        data-testid='submit-edit-prompt-button'
        disabled={!editPromptForm.isDirty() || !editPromptForm.isValid()}
        loading={updatePromptIsPending}
        mt='md'
      >
        {updatePromptIsPending ? 'Saving Changes' : 'Save Changes'}
      </Button>
    </form>
  );
}
