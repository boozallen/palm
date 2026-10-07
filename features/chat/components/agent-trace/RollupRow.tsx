import { Group, Text, Loader } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';

import { getToolTagLabel } from '@/features/chat/utils/chatHelperFunctions';
import { DEFAULT_THINKING_LABEL } from '@/features/chat/types/agent-trace';

type RollupRowProps = Readonly<{
  toolCallCount: number;
  completedToolCallCount: number;
  isProcessing: boolean;
  flash?: boolean;
  lastToolName?: string | null;
  lastStepLabel?: string | null;
  lastStepIsPlainLabel?: boolean;
  summaryLabel?: string;
}>;

export default function RollupRow({
  toolCallCount,
  completedToolCallCount,
  isProcessing,
  flash = false,
  lastToolName = null,
  lastStepLabel = null,
  lastStepIsPlainLabel = true,
  summaryLabel,
}: RollupRowProps) {
  const count = toolCallCount;
  const rollupCount = `${count} tool ${count === 1 ? 'call' : 'calls'}`;

  return (
    <Group spacing={6} noWrap sx={{ minWidth: 0, overflow: 'hidden' }}>
      {isProcessing && <Loader size='sm' variant='dots' color='blue' />}
      {isProcessing && !lastStepIsPlainLabel && lastToolName && (
        <Text size='xs' c='gray.4' sx={{ flexShrink: 0 }}>
          {getToolTagLabel(lastToolName)}
        </Text>
      )}
      <Text
        size='xs'
        c='gray.4'
        data-testid='agent-trace-rollup-label'
        sx={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
        }}
      >
        {!isProcessing
          ? (summaryLabel ?? 'Done')
          : lastStepIsPlainLabel
            ? (lastStepLabel ?? DEFAULT_THINKING_LABEL)
            : <>{'"'}{lastStepLabel}{'"'}</>
        }
      </Text>
      {isProcessing && count > 0 && (
        <>
          <Text size='xs' c='gray.6' style={{ flexShrink: 0 }}>·</Text>
          <Text size='xs' c='gray.6' style={{ flexShrink: 0 }}>{rollupCount}</Text>
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
