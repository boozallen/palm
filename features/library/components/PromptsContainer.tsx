import React from 'react';
import { SimpleGrid, Text } from '@mantine/core';

import { PromptListTable } from '@/features/library/components/PromptListTable';
import { PromptCardsContainer } from '@/features/library/components/PromptCardsContainer';
import { Prompt } from '@/features/shared/types';
import { PromptStatsMap } from '@/features/shared/types/prompt';

interface PromptsContainerProps {
  prompts: Prompt[];
  isTableView: boolean;
  stats: PromptStatsMap;
}

const PromptsContainer: React.FC<PromptsContainerProps> = ({ prompts, isTableView, stats }) => {
  let content;
  if (prompts?.length) {
    content = isTableView ? (
      <PromptListTable prompts={prompts} stats={stats} />
    ) : (
      <PromptCardsContainer prompts={prompts} stats={stats} />
    );
  } else {
    content = (
      <Text c='gray.6' fz='xl'>
        No results were found.
      </Text>
    );
  }

  return (
    <SimpleGrid
      cols={isTableView ? 1 : 4}
      breakpoints={
        isTableView
          ? []
          : [
            { maxWidth: 'xl', cols: 3, spacing: 'lg' },
            { maxWidth: 'lg', cols: 2, spacing: 'lg' },
            { maxWidth: 'md', cols: 2, spacing: 'lg' },
            { maxWidth: 'sm', cols: 1, spacing: 'lg' },
          ]
      }
      spacing='lg'
      verticalSpacing='lg'
      p='md'
    >
      {content}
    </SimpleGrid>
  );
};

export default PromptsContainer;
