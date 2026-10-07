/**
 * Prompt Selector - Dropdown to select saved prompts from library
 */

import { useState } from 'react';
import { Select, Loader } from '@mantine/core';
import { trpc } from '@/libs';

interface PromptSelectorProps {
  readonly onSelect: (instructions: string) => void;
}

export default function PromptSelector({ onSelect }: PromptSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading } = trpc.library.getPrompts.useQuery({});

  const promptOptions =
    data?.prompts?.map((prompt) => ({
      value: prompt.id,
      label: prompt.title,
      description: prompt.summary,
    })) || [];

  const handleChange = (id: string | null) => {
    setSelectedId(id);
    if (!id) { return; }
    const prompt = data?.prompts?.find((p) => p.id === id);
    if (prompt) { onSelect(prompt.instructions); }
  };

  return (
    <Select
      label='Select from Prompt Library'
      placeholder='Select a prompt'
      data-testid='prompt-selector'
      value={selectedId}
      onChange={handleChange}
      data={promptOptions}
      searchable
      clearable
      rightSection={isLoading ? <Loader size='xs' /> : undefined}
      disabled={isLoading}
      nothingFound='No prompts found. Create one in the Prompt Library first.'
    />
  );
}
