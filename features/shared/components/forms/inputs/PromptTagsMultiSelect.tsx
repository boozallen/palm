import { useState, useMemo, useEffect } from 'react';
import { useDebouncedState } from '@mantine/hooks';
import { MultiSelect, Loader } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';

import { useGetTags } from '@/features/shared/api/get-tags';
import { promptTagSchema, PromptFormValues } from '@/features/shared/types';

type PromptTagsMultiSelectProps = {
  form: UseFormReturnType<PromptFormValues>;
};

export default function PromptTagsMultiSelect({ form }: PromptTagsMultiSelectProps) {
  const [searchQuery, setSearchQuery] = useDebouncedState<string>('', 500);

  const [selectedTags, setSelectedTags] = useState<string[]>((form.values.tags).sort());
  const [toBeCreatedTags, setToBeCreatedTags] = useState<string[]>([]);
  const { data: promptTags, refetch, isFetching: isLoadingTags } = useGetTags(searchQuery);
  const selectOptions = useMemo(() => {
    if (!promptTags || promptTags.tags.length === 0) {
      return [];
    } else {
      return promptTags.tags.map((tag) => promptTagSchema.parse(tag));
    }
  }, [promptTags]);

  useEffect(() => {
    if (searchQuery) {
      refetch();
    }
  }, [searchQuery, refetch]);

  useEffect(() => {
    setSelectedTags(form.values.tags);
  }, [form.values.tags]);

  const handleTagChange = (tags: string[]) => {
    tags.sort(); // stops false-positives from form.isDirty() method
    setSelectedTags(tags);
    form.setFieldValue('tags', tags);
  };

  function onCreate(query: string) {
    try {
      let sanitizedQuery = promptTagSchema.parse(query);
      setToBeCreatedTags([...toBeCreatedTags, sanitizedQuery]);
      setSelectedTags((prevTags) => {
        const updatedTags = [...prevTags, sanitizedQuery];
        form.setFieldValue('tags', updatedTags);
        return updatedTags;
      });

      return sanitizedQuery;
    } catch (e) {
      if (e instanceof z.ZodError) {
        const error = e.errors[0];
        form.setFieldError('tags', error.message);
      }

      return null;
    }
  }

  return (
    <MultiSelect
      label='Tags'
      name='tags'
      data-testid='prompt-tags-multiselect'
      data={[...new Set([...toBeCreatedTags, ...selectedTags, ...selectOptions])]}
      placeholder='Type to search or create a tag'
      getCreateLabel={(query) => `+ Create Tag: ${query}`}
      creatable
      searchable
      maxSelectedValues={3}
      value={selectedTags}
      onChange={handleTagChange}
      onSearchChange={setSearchQuery}
      onCreate={onCreate}
      rightSection={isLoadingTags ? <Loader data-testid='tag-search-loader' size='sm' /> : null}
    />
  );
}
