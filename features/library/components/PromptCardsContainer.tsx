import { Card, createStyles, Group, Stack, Text, Title, useMantineTheme } from '@mantine/core';
import { useRouter } from 'next/router';
import { KeyboardEvent, MouseEvent } from 'react';

import TagBadges from '@/components/elements/TagBadges';
import { Prompt, PromptStatsMap } from '@/features/shared/types';
import { generatePromptUrl } from '@/features/shared/utils/prompt-helpers';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';
import PromptActions from './PromptActions';
import PromptStatsBadges from './PromptStatsBadges';

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
  stats: PromptStatsMap;
};

export function PromptCardsContainer({ prompts, stats }: PromptCardProps) {

  const theme = useMantineTheme();
  const router = useRouter();
  const { classes } = useStyles();
  const track = useTrackClientEvent();

  const recordInteraction = (prompt: Prompt, url: string) => {
    track.navigate(prompt.title, url);
  };

  // Card view handlers
  const handleCardOnClick = (event: React.MouseEvent<HTMLDivElement, MouseEvent>, prompt: Prompt) => {
    const url = generatePromptUrl(prompt.title, prompt.id);
    recordInteraction(prompt, url);
    router.push(url);
    event.stopPropagation();
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, prompt: Prompt) => {
    if (event.key === 'Enter') {
      const url = generatePromptUrl(prompt.title, prompt.id);
      recordInteraction(prompt, url);
      router.push(url);
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
            <Group spacing='xs' bg='dark.4' p='sm' align='center'>
              <TagBadges tags={prompt.tags} />
            </Group>
            <Title color='gray.6' p={`${theme.spacing.md} ${theme.spacing.md} ${theme.spacing.sm}`}>{prompt.title}</Title>
            <Text className={classes.summaryText} size='xssm' color='gray.6' p={`0 ${theme.spacing.md} ${theme.spacing.sm}`}>{prompt.summary}</Text>
            <Group 
              position='apart' 
              align='center' 
              p={`${theme.spacing.sm} ${theme.spacing.md}`}
              style={{ 
                borderTop: `1px solid ${theme.colors.dark[4]}`, 
                marginTop: 'auto',
              }}
            >
              <PromptActions id={prompt.id} title={prompt.title} creatorId={prompt.creatorId} />
              {stats[prompt.id] && (
                <PromptStatsBadges stats={stats[prompt.id]} />
              )}
            </Group>
          </Stack>
        </Card>
      ))}
    </>
  );
}
