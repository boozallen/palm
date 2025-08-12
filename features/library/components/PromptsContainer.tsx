import React from 'react';
import { SimpleGrid, Text, useMantineTheme } from '@mantine/core';
import { PromptListTable } from '@/features/library/components/PromptListTable';
import { PromptCardsContainer } from '@/features/library/components/PromptCardsContainer';
import { Prompt } from '@/features/shared/types';

interface PromptsContainerProps {
  prompts: Prompt[];
  isTableView: boolean;
}

const PromptsContainer: React.FC<PromptsContainerProps> = ({ prompts, isTableView }) => {
  const theme = useMantineTheme();

  let content;
  if (prompts?.length) {
    content = isTableView ? (
      <PromptListTable prompts={prompts} />
    ) : (
      <PromptCardsContainer prompts={prompts} />
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
      p={`${theme.spacing.lg} ${theme.spacing.xl}`}
    >
      {content}
    </SimpleGrid>
  );
};

export default PromptsContainer;
