import { Box, Group, Text } from '@mantine/core';
import { IconFiles, IconMessageCode } from '@tabler/icons-react';
import { useReducedMotion } from '@mantine/hooks';

import FakeCursor from '../animation/FakeCursor';
import MockChatComposer from '../animation/MockChatComposer';
import useStepTimeline from '../animation/useStepTimeline';
import { MOCK, StepProps } from './content';

const BEATS = 3; // 0: cursor approaching; 1: "+" menu open; 2: menu dismissed

const MENU_ICONS = [IconFiles, IconMessageCode];

export default function UploadDocumentStep({ active, onComplete }: StepProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const beat = useStepTimeline({ active, beatCount: BEATS, reducedMotion, onComplete });
  // Keep the menu shown under reduced motion (final beat) since it's the meaningful state.
  const open = reducedMotion || beat === 1;

  return (
    <Box sx={{ position: 'relative' }} aria-hidden>
      {open && (
        <Box
          sx={(theme) => ({
            position: 'absolute',
            left: 12,
            bottom: 44,
            zIndex: 4,
            width: 200,
            borderRadius: theme.radius.sm,
            backgroundColor: theme.colors.dark[7],
            border: `1px solid ${theme.colors.dark[4]}`,
            boxShadow: theme.shadows.md,
            overflow: 'hidden',
          })}
        >
          {MOCK.addMenuOptions.map((label, i) => {
            const Icon = MENU_ICONS[i];
            return (
              <Group
                key={label}
                spacing={8}
                sx={(theme) => ({
                  padding: '7px 12px',
                  color: theme.colors.gray[3],
                  flexWrap: 'nowrap',
                })}
              >
                {Icon && <Icon size={16} color='#909296' />}
                <Text size='xs' sx={{ whiteSpace: 'nowrap' }}>{label}</Text>
              </Group>
            );
          })}
        </Box>
      )}

      <MockChatComposer
        inputText='How can I help you?'
        isPlaceholder
        modelLabel={MOCK.selectedModel}
        highlightAdd={open}
      />

      <Box sx={{ position: 'absolute', left: 20, bottom: 30, width: 0, height: 0 }}>
        <FakeCursor
          x={beat === 0 ? 150 : 0}
          y={beat === 0 ? -44 : 0}
          clicking={open}
        />
      </Box>
    </Box>
  );
}
