import { useState } from 'react';
import { IconX } from '@tabler/icons-react';
import {
  Group,
} from '@mantine/core';
import { type UseFormReturnType } from '@mantine/form';
import { notifications } from '@mantine/notifications';

import {
  PromptFormValues,
} from '@/features/shared/types';
import PromptTagSuggestionIcon from '@/features/shared/components/elements/PromptTagSuggestionIcon';
import PromptTagSuggestionContainer from './PromptTagSuggestionContainer';
import PromptTagsMultiSelect from '@/features/shared/components/forms/inputs/PromptTagsMultiSelect';
import useGetPromptTagSuggestions from '@/features/shared/api/get-prompt-tag-suggestions';

type PromptTagsSelectAndSuggestionsProps = {
  form: UseFormReturnType<PromptFormValues>;
  promptTagSuggestionsEnabled: boolean;
};

export default function PromptTagsSelectAndSuggestions({ form, promptTagSuggestionsEnabled }: PromptTagsSelectAndSuggestionsProps) {

  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [suggestionContainerIsOpen, setSuggestionContainerIsOpen] =
    useState(false);

  const {
    mutate: promptTagSuggestions,
    isPending: promptTagSuggestionsIsPending,
  } = useGetPromptTagSuggestions();

  const getPromptTagSuggestions = (values: PromptFormValues) => {
    form.validate();
    if (form.isValid()) {
      promptTagSuggestions({ prompt: values },
        {
          onSuccess: (data) => {
            setSuggestedTags(data.tags);
            setSuggestionContainerIsOpen(true);
          },
          onError: (error) => {
            notifications.show({
              id: 'get_prompt_tag_suggestions',
              title: 'Failed to Get Suggested Prompt Tags',
              message:
                error.message ||
                'Could not get suggested prompt tags. Please try again later.',
              icon: <IconX />,
              variant: 'failed_operation',
              autoClose: false,
              withCloseButton: true,
            });
          },
        }
      );
    }
  };

  return (
    <>
      <Group mb='md' align='end'>
        <PromptTagsMultiSelect form={form} />
        {promptTagSuggestionsEnabled && (
          <PromptTagSuggestionIcon
            enabled={!Object.keys(form.errors).length}
            isLoading={promptTagSuggestionsIsPending}
            onClick={() => getPromptTagSuggestions(form.values)}
          />
        )}
      </Group>
      {suggestionContainerIsOpen && !promptTagSuggestionsIsPending && (
        <PromptTagSuggestionContainer
          tags={suggestedTags}
          onAccept={(tags) => form.setFieldValue('tags', tags)}
          onClose={() => setSuggestionContainerIsOpen(false)}
        />
      )}
    </>
  );
}
