import { ActionIcon, Box, Group } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { useEffect, useRef } from 'react';

import StartHereSequence from './StartHereSequence';

export function StartHereWalkthrough({ onClose }: { onClose: () => void }) {
  const sequenceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sequenceRef.current?.focus();
  }, []);

  return (
    <Box
      ref={sequenceRef}
      tabIndex={-1}
      data-testid='start-here-walkthrough'
      mt='2px'
      sx={(theme) => ({
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.dark[6],
        border: `1px solid ${theme.colors.dark[4]}`,
        borderTop: `3px solid ${theme.colors.orange[6]}`,
        padding: theme.spacing.md,
        outline: 'none',
      })}
    >
      <Group position='right'>
        <ActionIcon aria-label='Close' variant='subtle' color='gray' onClick={onClose}>
          <IconX size={18} />
        </ActionIcon>
      </Group>
      <Box data-testid='start-here-sequence'>
        <StartHereSequence onDone={onClose} />
      </Box>
    </Box>
  );
}
