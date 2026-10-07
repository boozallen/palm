import { Box, UnstyledButton, Collapse, Timeline, Loader } from '@mantine/core';
import { useMemo, useState, useEffect, useRef, ReactNode } from 'react';
import { IconCheck, IconBrain, IconPencil, IconTool, IconX } from '@tabler/icons-react';

import { AgentTraceStep as AgentTraceStepType, AgentTraceStepType as StepType, AgentTraceStepStatus as StepStatus, AgentTraceRollup } from '@/features/chat/types/agent-trace';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';
import AgentTraceStep from './AgentTraceStep';
import RollupRow from './RollupRow';

const EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const READ_TOOLS = new Set(['Read']);
const RUN_TOOLS = new Set(['Bash']);
const SEARCH_TOOLS = new Set(['search', 'cypher_query', 'Grep', 'Glob', 'get_library_documents', 'WebSearch']);
const FETCH_TOOLS = new Set(['WebFetch']);

// Turns the flat step list into a plain-language recap (e.g. "Edited 2 files, read a file")
// instead of a bare tool-call count, falling back to a count only for unrecognized tools.
function summarizeToolCalls(steps: AgentTraceStepType[]): string {
  let edited = 0;
  let read = 0;
  let ran = 0;
  let searched = 0;
  let fetched = 0;
  let other = 0;

  const visit = (step: AgentTraceStepType) => {
    if (step.type === StepType.ToolCall || step.type === StepType.SubagentToolCall) {
      const name = step.toolName;
      if (name && EDIT_TOOLS.has(name)) { edited++; }
      else if (name && READ_TOOLS.has(name)) { read++; }
      else if (name && RUN_TOOLS.has(name)) { ran++; }
      else if (name && SEARCH_TOOLS.has(name)) { searched++; }
      else if (name && FETCH_TOOLS.has(name)) { fetched++; }
      else { other++; }
    }
    step.children?.forEach(visit);
  };
  steps.forEach(visit);

  const parts: string[] = [];
  if (edited > 0) { parts.push(`edited ${edited} ${edited === 1 ? 'file' : 'files'}`); }
  if (read > 0) { parts.push(`read ${read === 1 ? 'a file' : `${read} files`}`); }
  if (ran > 0) { parts.push(`ran ${ran === 1 ? 'a command' : `${ran} commands`}`); }
  if (searched > 0) { parts.push(`searched ${searched === 1 ? 'once' : `${searched} times`}`); }
  if (fetched > 0) { parts.push(`fetched ${fetched === 1 ? 'a page' : `${fetched} pages`}`); }

  const total = edited + read + ran + searched + fetched + other;
  if (parts.length === 0) {
    return total === 0 ? 'Done' : `Used ${total} ${total === 1 ? 'tool' : 'tools'}`;
  }
  if (other > 0) { parts.push(`used ${other} other ${other === 1 ? 'tool' : 'tools'}`); }

  const [first, ...rest] = parts;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(', ');
}

function getStepBullet(step: AgentTraceStepType): ReactNode {
  if (step.status === StepStatus.Running) {
    return <Loader size={10} color='blue' />;
  }
  if (step.status === StepStatus.Error) {
    return <IconX size={12} style={{ color: 'var(--mantine-color-red-5)' }} />;
  }
  if (step.type === StepType.Thinking) {
    return <IconBrain size={12} />;
  }
  if (step.type === StepType.Writing) {
    return <IconPencil size={12} />;
  }
  if (step.type === StepType.ToolCall || step.type === StepType.SubagentToolCall) {
    if (!step.toolName) { return <IconPencil size={12} />; }
    return <IconTool size={12} />;
  }
  if (step.type === StepType.SubagentProgress) {
    return <IconPencil size={12} />;
  }
  if (step.type === StepType.SubagentComplete) {
    return <IconCheck size={12} />;
  }
  return <IconCheck size={12} />;
}

type AgentTraceProps = Readonly<{
  steps: AgentTraceStepType[];
  rollup?: AgentTraceRollup;
  isProcessing?: boolean;
}>;

function calculateRollup(steps: AgentTraceStepType[]): AgentTraceRollup {
  let totalTokens = 0;
  let totalDurationMs = 0;
  let toolCallCount = 0;
  let completedToolCallCount = 0;

  const processStep = (step: AgentTraceStepType) => {
    if (step.status === StepStatus.Done) {
      if (step.inputTokens !== undefined) { totalTokens += step.inputTokens; }
      if (step.outputTokens !== undefined) { totalTokens += step.outputTokens; }
      if (step.durationMs !== undefined) { totalDurationMs += step.durationMs; }
      if (step.type === StepType.ToolCall || step.type === StepType.SubagentToolCall) { completedToolCallCount++; }
    }
    if (step.type === StepType.ToolCall || step.type === StepType.SubagentToolCall) { toolCallCount++; }
    if (step.children) { step.children.forEach(processStep); }
  };

  steps.forEach(processStep);

  return {
    totalTokens,
    totalDurationMs,
    toolCallCount,
    completedToolCallCount,
  };
}

export default function AgentTrace({ steps, rollup: providedRollup, isProcessing = false }: AgentTraceProps) {
  const [expanded, setExpanded] = useState(false);
  const track = useTrackClientEvent();
  const [flash, setFlash] = useState(false);
  const [, setTick] = useState(0);
  const prevLastStepRef = useRef<string | null>(null);
  const stepTimestamps = useRef<Record<string, number>>({});
  const rollup = useMemo(
    () => providedRollup || calculateRollup(steps),
    [steps, providedRollup]
  );

  const allBodySteps = useMemo(() => steps, [steps]);

  useEffect(() => {
    const now = Date.now();
    for (const step of steps) {
      if (!stepTimestamps.current[step.id]) {
        stepTimestamps.current[step.id] = now;
      }
    }
  }, [steps]);

  useEffect(() => {
    if (!isProcessing) { return; }
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isProcessing]);

  const summaryLabel = useMemo(() => summarizeToolCalls(allBodySteps), [allBodySteps]);

  const lastStep = allBodySteps[allBodySteps.length - 1];
  const displayStep = lastStep;
  const lastStepIsPlainLabel = displayStep?.type === StepType.Thinking || displayStep?.type === StepType.Writing || displayStep?.type === StepType.SubagentProgress || displayStep?.type === StepType.SubagentComplete || !displayStep?.toolName;
  const lastStepLabel = displayStep?.toolLabel || null;

  useEffect(() => {
    if (!isProcessing || !lastStepLabel) { return; }
    if (lastStepLabel !== prevLastStepRef.current) {
      prevLastStepRef.current = lastStepLabel;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(t);
    }
  }, [lastStepLabel, isProcessing]);

  const hasSteps = steps.length > 0;

  // Audited off the current state rather than inside the updater: an updater can
  // run more than once for one click, which would write duplicate records.
  const handleToggle = () => {
    // Label the state being moved to, not the one being left, matching the
    // wording of the other panel toggles.
    track.togglePanel(expanded ? 'Collapse agent trace' : 'Expand agent trace');
    setExpanded((v) => !v);
  };

  if (!hasSteps) {
    if (!isProcessing) {
      return null;
    }
    return (
      <Box mb='md'>
        <Box sx={{ padding: '3px 0' }}>
          <RollupRow
            toolCallCount={0}
            completedToolCallCount={0}
            isProcessing={true}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box mb='md'>
      <UnstyledButton
        variant='timeline_toggle'
        onClick={handleToggle}
        data-testid='agent-trace-toggle'
      >
        <RollupRow
          toolCallCount={rollup.toolCallCount}
          completedToolCallCount={rollup.completedToolCallCount ?? 0}
          isProcessing={isProcessing}
          flash={flash}
          lastToolName={displayStep?.toolName ?? null}
          lastStepLabel={lastStepLabel}
          lastStepIsPlainLabel={lastStepIsPlainLabel}
          summaryLabel={summaryLabel}
        />
      </UnstyledButton>

      <Collapse in={expanded}>
        <Timeline
          bulletSize={20}
          lineWidth={1}
          styles={(t) => ({
            itemBullet: {
              backgroundColor: t.colors.dark[7],
              borderColor: t.colors.dark[4],
              color: t.colors.gray[5],
              '&[data-with-child]': {
                backgroundColor: t.colors.dark[7],
                color: t.colors.gray[5],
              },
            },
          })}
        >
          {allBodySteps.map((step, idx) => {
            const isLastStep = idx === allBodySteps.length - 1;
            const startedAt = stepTimestamps.current[step.id];
            const nextStartedAt = !isLastStep ? stepTimestamps.current[allBodySteps[idx + 1]?.id] : undefined;
            const elapsedMs = startedAt
              ? isLastStep && isProcessing
                ? Date.now() - startedAt
                : nextStartedAt
                  ? nextStartedAt - startedAt
                  : undefined
              : undefined;
            return (
              <Timeline.Item key={step.id} bullet={getStepBullet(step)} style={{ marginTop: '12px' }}>
                <AgentTraceStep step={step} elapsedMs={elapsedMs} isProcessing={isProcessing && isLastStep} />
              </Timeline.Item>
            );
          })}
          {!isProcessing && (
            <Timeline.Item bullet={getStepBullet({ id: 'done', type: StepType.Done, status: StepStatus.Done })} style={{ marginTop: '12px' }}>
              <AgentTraceStep step={{ id: 'done', type: StepType.Done, status: StepStatus.Done }} />
            </Timeline.Item>
          )}
        </Timeline>
      </Collapse>
    </Box>
  );
}
