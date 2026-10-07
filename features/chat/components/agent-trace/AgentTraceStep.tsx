import { Box, Text, Group } from '@mantine/core';

import { AgentTraceStep as AgentTraceStepType, AgentTraceStepType as StepType, DEFAULT_THINKING_LABEL } from '@/features/chat/types/agent-trace';
import SubagentCompleteRow from './SubagentCompleteRow';
import ToolCallRow from './ToolCallRow';

type AgentTraceStepProps = Readonly<{
  step: AgentTraceStepType;
  elapsedMs?: number;
  isProcessing?: boolean;
}>;

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) { return `${seconds}s`; }
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

export default function AgentTraceStep({ step, elapsedMs, isProcessing }: AgentTraceStepProps) {
  const showTimer = elapsedMs !== undefined && elapsedMs >= 1000;
  const timerEl = showTimer
    ? <Text size='xs' c='gray.6' style={{ fontVariantNumeric: 'tabular-nums', marginLeft: 'auto', flexShrink: 0 }}>{formatElapsed(elapsedMs)}</Text>
    : null;

  switch (step.type) {
    case StepType.ToolCall:
      return <ToolCallRow step={step} elapsedMs={showTimer ? elapsedMs : undefined} />;

    case StepType.Thinking:
    case StepType.Writing:
      return (
        <Box py={2}>
          <Group spacing={8} noWrap>
            <Text size='xs' c='gray.4'>
              {step.toolLabel || DEFAULT_THINKING_LABEL}
            </Text>
            {timerEl}
          </Group>
        </Box>
      );

    case StepType.SubagentToolCall:
      return <ToolCallRow step={step} elapsedMs={showTimer ? elapsedMs : undefined} />;

    case StepType.SubagentProgress:
      return (
        <Box py={1}>
          <Group spacing={6} noWrap>
            <Text size='xs' c='gray.4'>
              {step.toolLabel}
            </Text>
            {step.completed !== undefined && step.total !== undefined && (
              <Text size='xs' c='gray.6' style={{ fontVariantNumeric: 'tabular-nums' }}>
                {step.completed}/{step.total}
              </Text>
            )}
            {timerEl}
          </Group>
        </Box>
      );

    case StepType.SubagentComplete:
      return <SubagentCompleteRow step={step} />;

    case StepType.Done:
      return (
        <Box py={2}>
          <Text size='xs' c='gray.4'>Done</Text>
        </Box>
      );

    default:
      return null;
  }
}
