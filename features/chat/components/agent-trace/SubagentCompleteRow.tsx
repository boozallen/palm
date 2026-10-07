import { Box, Group, Text } from '@mantine/core';

import { AgentTraceStep } from '@/features/chat/types/agent-trace';

type SubagentCompleteRowProps = Readonly<{
  step: AgentTraceStep;
}>;

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${(ms / 60000).toFixed(1)}m`;
}

export default function SubagentCompleteRow({ step }: SubagentCompleteRowProps) {
  return (
    <Box py={4}>
      <Group spacing={8}>
        <Text size='xs' c='gray.4'>
          {step.toolLabel || 'Complete'}
        </Text>
        {step.durationMs !== undefined && (
          <Text size='xs' c='gray.7' style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatDuration(step.durationMs)}
          </Text>
        )}
      </Group>
    </Box>
  );
}
