import { Box, Group, Text, Badge } from '@mantine/core';

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
        <Badge
          size='xs'
          variant='filled'
          sx={(t) => ({
            backgroundColor: t.colors.green[9],
            color: t.colors.green[3],
            fontWeight: 500,
            textTransform: 'none',
          })}
        >
          {step.toolLabel || 'Complete'}
        </Badge>
        {step.durationMs !== undefined && (
          <Text size='xs' c='dimmed' style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatDuration(step.durationMs)}
          </Text>
        )}
      </Group>
    </Box>
  );
}
