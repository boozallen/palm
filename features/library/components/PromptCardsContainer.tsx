import { Card, createStyles, Group, Stack, Text, Title, useMantineTheme } from '@mantine/core';
import { useRouter } from 'next/router';
import TagBadges from '@/components/elements/TagBadges';
import { Prompt } from '@/features/shared/types';
import { generatePromptUrl } from '@/features/shared/utils/prompt-helpers';
import PromptActions from './PromptActions';
import { KeyboardEvent, MouseEvent } from 'react';

const useStyles = createStyles((theme) => ({
  card: {
    minHeight: '188px',
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    ':hover': {
      background: theme.colors.dark[5],
      cursor: 'pointer',
    },
    ':focus-visible': {
      borderColor: theme.colors.blue[6],
      borderWidth: '1px',
    },
  },
  summaryText: {
    flexGrow: 1,
  },
}));

type PromptCardProps = {
  prompts: Prompt[];
};

export function PromptCardsContainer({ prompts }: PromptCardProps) {

  const theme = useMantineTheme();
  const router = useRouter();
  const { classes } = useStyles();

  // Card view handlers
  const handleCardOnClick = (event: React.MouseEvent<HTMLDivElement, MouseEvent>, prompt: Prompt) => {
    router.push(generatePromptUrl(prompt.title, prompt.id));
    event.stopPropagation();
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, prompt: Prompt) => {
    if (event.key === 'Enter') {
      router.push(generatePromptUrl(prompt.title, prompt.id));
      event.stopPropagation();
    }
  };

  return (
    <>
      {prompts?.map((prompt) => (
        <Card
          className={classes.card}
          aria-label={'prompt-card: ' + prompt.title}
          key={prompt.id}
          tabIndex={0}
          shadow='sm'
          p='none'
          radius='6px'
          withBorder={true}
          onClick={(event: MouseEvent<HTMLDivElement, MouseEvent>) => handleCardOnClick(event, prompt)}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => handleCardKeyDown(event, prompt)}
        >
          <Stack spacing='0' h='100%'>
            <Group spacing='xs' bg='dark.4' p={`${theme.spacing.md} ${theme.spacing.md} ${theme.spacing.sm}`}>
              <TagBadges tags={prompt.tags} />
            </Group>
            <Title color='gray.6' p={`${theme.spacing.md} ${theme.spacing.md} ${theme.spacing.sm}`}>{prompt.title}</Title>
            <Text className={classes.summaryText} size='xssm' color='gray.6' p={`0 ${theme.spacing.md} ${theme.spacing.sm}`}>{prompt.summary}</Text>
            <PromptActions id={prompt.id} title={prompt.title} creatorId={prompt.creatorId} /> 
          </Stack>
        </Card>
      ))}
    </>
  );
}
