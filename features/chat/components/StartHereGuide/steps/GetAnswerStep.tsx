import { Box, Group, Stack, Text } from '@mantine/core';
import { IconDownload, IconFileText } from '@tabler/icons-react';
import { useReducedMotion } from '@mantine/hooks';

import useStepTimeline from '../animation/useStepTimeline';
import { MOCK, StepProps } from './content';

// 0: thinking, 1..N: answer lines revealed, N+1: artifact card
const BEATS = MOCK.answerLines.length + 2;

export default function GetAnswerStep({ active, onComplete }: StepProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const beat = useStepTimeline({ active, beatCount: BEATS, reducedMotion, onComplete });
  const linesShown = Math.max(0, Math.min(beat, MOCK.answerLines.length));
  const showArtifact = beat >= MOCK.answerLines.length + 1;

  return (
    <Box
      sx={(theme) => ({
        position: 'relative',
        minHeight: 140,
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.dark[7],
        padding: theme.spacing.md,
      })}
    >
      <Stack spacing={4} aria-hidden>
          {beat === 0 && <Text size='sm' color='gray.5'>Thinking…</Text>}
          {MOCK.answerLines.slice(0, linesShown).map((line) => (
            <Text key={line} size='sm' color='gray.2'>{line}</Text>
          ))}
          {showArtifact && (
            <Group
              spacing={8}
              mt={8}
              sx={(theme) => ({
                backgroundColor: theme.colors.dark[5],
                borderRadius: theme.radius.sm,
                padding: '6px 10px',
                width: 'fit-content',
              })}
            >
              <IconFileText size={16} color='#74b9ff' />
              <Text size='xs' color='gray.2'>{MOCK.artifactName}</Text>
              <IconDownload size={14} color='#909296' />
            </Group>
          )}
        </Stack>
    </Box>
  );
}
