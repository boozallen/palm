import { Group, Text, Loader, Code } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';

type RollupRowProps = Readonly<{
  toolCallCount: number;
  completedToolCallCount: number;
  isProcessing: boolean;
  flash?: boolean;
  lastToolName?: string | null;
  lastStepLabel?: string | null;
  lastStepIsPlainLabel?: boolean;
}>;

export default function RollupRow({
  toolCallCount,
  completedToolCallCount,
  isProcessing,
  flash = false,
  lastToolName = null,
  lastStepLabel = null,
  lastStepIsPlainLabel = true,
}: RollupRowProps) {
  const count = toolCallCount;
  const rollupCount = `${count} tool ${count === 1 ? 'call' : 'calls'}`;

  return (
    <Group spacing={6} noWrap sx={{ minWidth: 0, overflow: 'hidden' }}>
      {isProcessing && <Loader size='sm' variant='dots' color='blue' />}
      {isProcessing && !lastStepIsPlainLabel && lastToolName && (
        <Code
          sx={{
            fontSize: 11,
            color: 'var(--mantine-color-gray-5)',
            backgroundColor: 'transparent',
            padding: '0 4px',
            flexShrink: 0,
          }}
        >
          {lastToolName}
        </Code>
      )}
      <Text
        size='xs'
        c='dimmed'
        sx={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
        }}
      >
        {!isProcessing
          ? 'Done'
          : lastStepIsPlainLabel
            ? (lastStepLabel ?? 'Thinking...')
            : <em>{'"'}{lastStepLabel}{'"'}</em>
        }
      </Text>
      {count > 0 && (
        <>
          <Text size='xs' c='dimmed' style={{ flexShrink: 0 }}>·</Text>
          <Text size='xs' c='dimmed' style={{ flexShrink: 0 }}>{rollupCount}</Text>
        </>
      )}
      <IconChevronRight
        size={13}
        className='rollup-arrow'
        style={{
          color: 'var(--mantine-color-gray-5)',
          opacity: 0,
          transition: 'opacity 150ms ease',
          visibility: toolCallCount === 0 ? 'hidden' : 'visible',
          flexShrink: 0,
        }}
      />
    </Group>
  );
}
