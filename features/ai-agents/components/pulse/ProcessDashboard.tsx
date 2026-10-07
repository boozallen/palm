import {
  Alert,
  Badge,
  Group,
  List,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

import RunDownloads from '@/features/ai-agents/components/pulse/RunDownloads';
import { MATRIX_FALLBACK_VALUE } from '@/features/ai-agents/utils/pulse/parsePromptMatrix';
import type { PulseRunStatus, PulseRunView } from '@/features/ai-agents/types/pulse/results';
import type { PulseFieldSummary, PulseResult } from '@/features/ai-agents/types/pulse/surveyAnalysis';

export const MISSING_ACTIONS_MESSAGE = 'Recommended actions weren\'t generated. See the results dashboard for the numbers.';

const EMPTY_VALUE = '—';

const STATUS_DISPLAY: Record<PulseRunStatus, { label: string; color: string }> = {
  processing: { label: 'Processing', color: 'blue.6' },
  succeeded: { label: 'Succeeded', color: 'green.6' },
  succeededWithWarnings: { label: 'Succeeded with warnings', color: 'yellow.6' },
  failed: { label: 'Failed', color: 'red.6' },
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

function formatCount(value: number | null): string {
  return value === null ? EMPTY_VALUE : value.toLocaleString('en-US');
}

function formatDate(value: string | null): string {
  if (!value) {
    return EMPTY_VALUE;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? EMPTY_VALUE : date.toLocaleString('en-US', DATE_FORMAT);
}

export function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) {
    return EMPTY_VALUE;
  }

  const elapsed = new Date(finishedAt).getTime() - new Date(startedAt).getTime();

  if (Number.isNaN(elapsed) || elapsed < 0) {
    return EMPTY_VALUE;
  }

  const totalSeconds = Math.round(elapsed / 1000);

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const totalMinutes = Math.floor(totalSeconds / 60);

  if (totalMinutes < 60) {
    return `${totalMinutes}m ${totalSeconds % 60}s`;
  }

  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}

type ProcessDashboardProps = Readonly<{
  agentId: string;
  run: PulseRunView;
  fields: PulseFieldSummary[];
  results: PulseResult[];
}>;

export default function ProcessDashboard({ agentId, run, fields, results }: ProcessDashboardProps) {
  const theme = useMantineTheme();
  const status = STATUS_DISPLAY[run.status];
  const fallbacks = run.fallbacksByColumn.filter((fallback) => fallback.count > 0);
  const actions = run.recommendedActions ?? [];
  const showsNextSteps = run.status === 'succeeded' || run.status === 'succeededWithWarnings';

  const stats = [
    { testId: 'pulse-stat-rows-in-file', label: 'Rows in file', value: run.rowsInFile },
    { testId: 'pulse-stat-rows-analyzed', label: 'Rows analyzed', value: run.rowsAnalyzed },
    { testId: 'pulse-stat-skipped-failed', label: 'Skipped: failed', value: run.failedRowCount },
  ];

  const details = [
    { testId: 'pulse-run-model', label: 'Model', value: run.modelName ?? EMPTY_VALUE },
    { testId: 'pulse-run-file', label: 'Survey file', value: run.surveyFilename },
    { testId: 'pulse-run-started', label: 'Started', value: formatDate(run.createdAt) },
    { testId: 'pulse-run-finished', label: 'Finished', value: formatDate(run.completedAt) },
    { testId: 'pulse-run-duration', label: 'Duration', value: formatDuration(run.createdAt, run.completedAt) },
  ];

  return (
    <Stack spacing='lg' data-testid='pulse-process-dashboard'>
      <Group spacing='sm'>
        <Text weight={theme.other.fontWeights.medium}>Status</Text>
        <Badge data-testid='pulse-run-status' color={status.color} variant='filled' c='black'>
          {status.label}
        </Badge>
      </Group>

      {run.message && (
        <Alert
          data-testid='pulse-run-message'
          color={run.status === 'failed' ? 'red' : 'yellow'}
          icon={<IconAlertTriangle />}
        >
          <Stack spacing='xs'>
            <Text data-testid='pulse-run-message-cause' weight={theme.other.fontWeights.bold}>
              {run.message.cause}
            </Text>
            {run.message.fix && (
              <Text data-testid='pulse-run-message-fix' size='sm'>{run.message.fix}</Text>
            )}
          </Stack>
        </Alert>
      )}

      <SimpleGrid cols={4} breakpoints={[{ maxWidth: 'md', cols: 2 }]}>
        {stats.map((stat) => (
          <Stack key={stat.testId} spacing='xxs' bg='dark.7' p='md'>
            <Text size='sm' c='gray.4'>{stat.label}</Text>
            <Text data-testid={stat.testId} size='xl' weight={theme.other.fontWeights.bold}>
              {formatCount(stat.value)}
            </Text>
          </Stack>
        ))}
      </SimpleGrid>

      {fallbacks.length > 0 && (
        <Stack spacing='xs' data-testid='pulse-fallbacks'>
          <Title order={4}>Fallbacks by column</Title>
          <Text size='sm' c='gray.4'>
            {`Rows where a column fell back to "${MATRIX_FALLBACK_VALUE}".`}
          </Text>
          <Table>
            <thead>
              <tr>
                <th>Column</th>
                <th>Rows</th>
              </tr>
            </thead>
            <tbody>
              {fallbacks.map((fallback) => (
                <tr data-testid='pulse-fallback-row' key={fallback.fieldName}>
                  <td>{fallback.fieldName}</td>
                  <td>{fallback.count.toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Stack>
      )}

      <Stack spacing='xs'>
        <Title order={4}>Run details</Title>
        <SimpleGrid cols={5} breakpoints={[{ maxWidth: 'md', cols: 2 }]}>
          {details.map((detail) => (
            <Stack key={detail.testId} spacing='xxs'>
              <Text size='sm' c='gray.4'>{detail.label}</Text>
              <Text data-testid={detail.testId} size='sm'>{detail.value}</Text>
            </Stack>
          ))}
        </SimpleGrid>
      </Stack>

      {showsNextSteps && (
        <Stack spacing='xs' data-testid='pulse-next-steps'>
          <Title order={4}>What to do next</Title>
          {actions.length > 0 ? (
            <List spacing='sm'>
              {actions.map((item, index) => (
                <List.Item data-testid='pulse-next-action' key={`${index}:${item.action}`}>
                  <Text weight={theme.other.fontWeights.bold}>{item.action}</Text>
                  <Text size='sm' c='gray.4'>{item.rationale}</Text>
                </List.Item>
              ))}
            </List>
          ) : (
            <Text data-testid='pulse-next-steps-missing' size='sm' c='gray.4'>
              {MISSING_ACTIONS_MESSAGE}
            </Text>
          )}
        </Stack>
      )}

      <RunDownloads agentId={agentId} run={run} fields={fields} results={results} />
    </Stack>
  );
}
