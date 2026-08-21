import { Box } from '@mantine/core';
import { useReducedMotion } from '@mantine/hooks';

import FakeCursor from '../animation/FakeCursor';
import MockChatComposer from '../animation/MockChatComposer';
import useStepTimeline from '../animation/useStepTimeline';
import { MOCK, StepProps } from './content';

const BEATS = 3; // 0: closed, 1: dropdown open, 2: model selected

export default function ChooseModelStep({ active, onComplete }: StepProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const beat = useStepTimeline({ active, beatCount: BEATS, reducedMotion, onComplete });
  const open = beat >= 1 && beat < 2;
  const selected = beat >= 2;

  return (
    <Box sx={{ position: 'relative' }} aria-hidden>
        {open && (
          <Box
            sx={(theme) => ({
              position: 'absolute',
              right: 44,
              bottom: 44,
              zIndex: 4,
              width: 180,
              borderRadius: theme.radius.sm,
              backgroundColor: theme.colors.dark[7],
              border: `1px solid ${theme.colors.dark[4]}`,
              boxShadow: theme.shadows.md,
              overflow: 'hidden',
            })}
          >
            {MOCK.modelOptions.map((m) => (
              <Box
                key={m}
                sx={(theme) => ({
                  padding: '7px 12px',
                  color: m === MOCK.selectedModel ? theme.white : theme.colors.gray[3],
                  backgroundColor: m === MOCK.selectedModel ? theme.colors.dark[5] : 'transparent',
                  fontSize: 13,
                })}
              >
                {m}
              </Box>
            ))}
          </Box>
        )}

        <MockChatComposer
          inputText='How can I help you?'
          isPlaceholder
          modelLabel={selected ? MOCK.selectedModel : 'Select a model'}
          highlightModel={!selected}
        />

        {/* Anchored from the right edge so the cursor lands on the pill regardless of composer width. */}
        <Box sx={{ position: 'absolute', right: 96, bottom: 30, width: 0, height: 0 }}>
          <FakeCursor
            x={beat === 0 ? -150 : 0}
            y={beat === 0 ? -44 : 0}
            clicking={open}
          />
        </Box>
      </Box>
  );
}
