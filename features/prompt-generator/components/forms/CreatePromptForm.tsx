import { Button, Group, TextInput, Textarea, Box } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useCreatePrompt } from '@/features/shared/api/create-prompt';
import { ViewPromptMessage } from '@/features/shared/components/notifications';
import BackButton from '@/features/prompt-generator/components/buttons/BackButton';
import PromptTagSuggestionIcon from '@/features/shared/components/elements/PromptTagSuggestionIcon';
import Loading from '@/features/shared/components/Loading';
import PromptTagSuggestionContainer from '@/features/shared/components/forms/inputs/PromptTagSuggestionContainer';
import PromptTagsMultiSelect from '@/features/shared/components/forms/inputs/PromptTagsMultiSelect';
import useGetPromptTagSuggestions from '@/features/shared/api/get-prompt-tag-suggestions';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { useState } from 'react';
import { IconX, IconCheck } from '@tabler/icons-react';
import { usePromptGenerator } from '@/features/prompt-generator/providers';
import { PromptFormValues } from '@/features/shared/types';

export default function CreatePromptForm() {

  const { stepper, newPrompt } = usePromptGenerator();

  const { mutate: createPrompt, isPending } = useCreatePrompt();

  const { mutate: promptTagSuggestions, isPending: promptTagSuggestionsIsPending } =
    useGetPromptTagSuggestions();

  const { data: systemConfig, isPending: systemConfigPending } = useGetSystemConfig();

  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [suggestionContainerIsOpen, setSuggestionContainerIsOpen] = useState(false);

  if (systemConfigPending) {
    return <Loading />;
  }

  const getPromptTagSuggestions = (values: PromptFormValues) => {
    newPrompt.validate();
    if (newPrompt.isValid()) {
      promptTagSuggestions({ prompt: values }, {
        onSuccess: (data) => {
          setSuggestedTags(data.tags);
          setSuggestionContainerIsOpen(true);
        },
        onError: (error) => {
          notifications.show({
            id: 'get_prompt_tag_suggestions',
            title: 'Failed to Get Suggested Prompt Tags',
            message: error.message ?? 'Could not get suggested prompt tags. Please try again later.',
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
    createPrompt({ prompt: values }, {
      onSuccess: (data) => {
        const notificationId = `create_prompt_${data.prompt?.id}`;
        notifications.show({
          id: notificationId,
          title: 'Prompt Created',
          message: <ViewPromptMessage title={values.title} promptId={data.prompt.id} notificationId={notificationId} />,
          icon: <IconCheck />,
          autoClose: false,
          variant: 'successful_operation',
        });
        newPrompt.resetDirty();
      },
      onError: (error) => {
        const notificationId = 'create_prompt_failed';
        notifications.show({
          id: notificationId,
          title: 'Failed to Create Prompt',
          message: error.message ?? 'Could not create prompt. Please try again later.',
          icon: <IconX />,
          variant: 'failed_operation',
          autoClose: false,
          withCloseButton: true,
        });
      },
    });
  };

  return (
    <form onSubmit={newPrompt.onSubmit(handleSubmit)}>

      <Box px='xl' py='md'>
        <BackButton onClick={stepper.previousStep} />
      </Box>

      <Box bg='dark.6' px='xl' py='lg'>
        <TextInput
          label='Title'
          placeholder='Title here'
          {...newPrompt.getInputProps('title')}
        />
        <TextInput
          label='Summary'
          placeholder='Summary here'
          {...newPrompt.getInputProps('summary')}
        />

        <Textarea
          label='Description'
          description='Describe the impact of the prompt and how it can be used in functional roles for enhanced productivity.'
          placeholder='Description here'
          autosize
          minRows={5}
          maxRows={5}
          {...newPrompt.getInputProps('description')}
        />
        <Group mb='md' align='end'>
          <PromptTagsMultiSelect form={newPrompt} />
          {systemConfig?.featureManagementPromptTagSuggestions && (
            <PromptTagSuggestionIcon
              enabled={!Object.keys(newPrompt.errors).length}
              isLoading={promptTagSuggestionsIsPending}
              onClick={() => getPromptTagSuggestions(newPrompt.values)}
            />
          )}
        </Group>
        {suggestionContainerIsOpen && !promptTagSuggestionsIsPending && (
          <PromptTagSuggestionContainer
            tags={suggestedTags}
            onAccept={(tags) => newPrompt.setFieldValue('tags', tags)}
            onClose={() => setSuggestionContainerIsOpen(false)}
          />
        )}

        <Box pt='xs'>
          <Button
            type='submit'
            data-testid={'submit'}
            loading={isPending}
            disabled={!newPrompt.isValid() || !newPrompt.isDirty()}
          >
            Create Prompt
          </Button>
        </Box>
      </Box>
    </form>
  );
}
