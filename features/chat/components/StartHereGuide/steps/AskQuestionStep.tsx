import { Box } from '@mantine/core';
import { useReducedMotion } from '@mantine/hooks';

import FakeCursor from '../animation/FakeCursor';
import useStepTimeline from '../animation/useStepTimeline';
import { MOCK, StepProps } from './content';

const WORDS = MOCK.question.split(' ');
const BEATS = WORDS.length + 1;

export default function AskQuestionStep({ active, onComplete }: StepProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const beat = useStepTimeline({ active, beatCount: BEATS, beatMs: 300, reducedMotion, onComplete });
  const typed = WORDS.slice(0, Math.min(beat, WORDS.length)).join(' ');
  const sending = beat >= BEATS - 1;

  return (
    <Box
      sx={(theme) => ({
        position: 'relative',
        height: 140,
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.dark[7],
        padding: theme.spacing.md,
      })}
    >
        <Box
          aria-hidden
          sx={(theme) => ({
            border: `1px solid ${theme.colors.dark[4]}`,
            borderRadius: theme.radius.sm,
            padding: '10px 12px',
            minHeight: 40,
            color: theme.white,
            fontSize: 13,
          })}
        >
          {sending ? MOCK.question : typed}
        </Box>
        <FakeCursor x={sending ? 200 : 20} y={sending ? 70 : 20} clicking={sending} />
    </Box>
  );
}
