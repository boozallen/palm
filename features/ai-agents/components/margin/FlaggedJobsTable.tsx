import { useMemo, useState } from 'react';
import { Badge, Box, Divider, Group, Pagination, Stack, Table, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import type { FlaggedJob, MarginFlagType } from '@/features/ai-agents/types/margin';
import { LOW_MARGIN_THRESHOLD } from '@/features/ai-agents/utils/margin/analyzeMargins';

const PAGE_SIZE = 50;

type SortField = 'taskOrder' | 'month' | 'plannedMarginPct' | 'dollarImpact';
type SortDirection = 'asc' | 'desc';

const FLAG_COLORS: Record<MarginFlagType, string> = {
  NEGATIVE_MARGIN: 'red',
  LOW_MARGIN: 'orange',
  ZERO_REVENUE: 'gray',
  SIGNIFICANT_DROP: 'yellow',
  SIGNIFICANT_SWING: 'blue',
};

const FLAG_LABELS: Record<MarginFlagType, string> = {
  NEGATIVE_MARGIN: 'Negative',
  LOW_MARGIN: 'Low Margin',
  ZERO_REVENUE: 'Zero Rev',
  SIGNIFICANT_DROP: 'Sig Drop',
  SIGNIFICANT_SWING: 'Sig Swing',
};

type Props = Readonly<{
  flaggedJobs: FlaggedJob[];
}>;

type JobSummary = {
  taskOrder: string;
  clin: string;
  taskTitle: string;
  flaggedMonths: number;
  hasNegative: boolean;
  hasLowMargin: boolean;
};

export default function FlaggedJobsTable({ flaggedJobs }: Props) {
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('dollarImpact');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'dollarImpact' || field === 'plannedMarginPct' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const sortedJobs = useMemo(() => {
    const sorted = [...flaggedJobs].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'taskOrder':
          comparison = a.taskOrder.localeCompare(b.taskOrder);
          break;
        case 'month':
          comparison = a.month.localeCompare(b.month);
          break;
        case 'plannedMarginPct':
          comparison = a.plannedMarginPct - b.plannedMarginPct;
          break;
        case 'dollarImpact':
          comparison = Math.abs(a.dollarImpact) - Math.abs(b.dollarImpact);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [flaggedJobs, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedJobs.length / PAGE_SIZE);
  const pageItems = sortedJobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const jobSummaries = useMemo<JobSummary[]>(() => {
    const map = new Map<string, JobSummary>();
    for (const job of sortedJobs) {
      const key = `${job.taskOrder}__${job.clin}`;
      const existing = map.get(key);
      if (existing) {
        existing.flaggedMonths++;
        if (job.dollarImpact < 0) {
          existing.hasNegative = true;
        }
        if (job.plannedMarginPct >= 0 && job.plannedMarginPct < LOW_MARGIN_THRESHOLD) {
          existing.hasLowMargin = true;
        }
      } else {
        map.set(key, {
          taskOrder: job.taskOrder,
          clin: job.clin,
          taskTitle: job.taskTitle,
          flaggedMonths: 1,
          hasNegative: job.dollarImpact < 0,
          hasLowMargin: job.plannedMarginPct >= 0 && job.plannedMarginPct < LOW_MARGIN_THRESHOLD,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.flaggedMonths - a.flaggedMonths);
  }, [sortedJobs]);

  if (sortedJobs.length === 0) {
    return (
      <Text color='dimmed' size='sm'>
        No flagged jobs found.
      </Text>
    );
  }

  return (
    <Stack spacing='md'>
      {/* Summary list */}
      <Box>
        <Text size='sm' weight={600} mb='xs'>
          {jobSummaries.length} flagged {jobSummaries.length === 1 ? 'job' : 'jobs'} · {sortedJobs.length} flagged {sortedJobs.length === 1 ? 'month' : 'months'}
        </Text>
        <Stack spacing={4}>
          {jobSummaries.map((job) => (
            <Group key={`${job.taskOrder}__${job.clin}`} spacing='xs'>
              <Text size='sm' color='dimmed' sx={{ fontFamily: 'monospace' }}>
                {job.taskOrder} · {job.clin}
              </Text>
              <Text size='sm'>{job.taskTitle}</Text>
              <Badge size='xs' color={job.hasNegative ? 'red' : job.hasLowMargin ? 'orange' : 'yellow'} variant='filled'>
                {job.flaggedMonths} {job.flaggedMonths === 1 ? 'month' : 'months'}
              </Badge>
            </Group>
          ))}
        </Stack>
      </Box>

      <Divider />

    <>
      <Table striped highlightOnHover withBorder withColumnBorders>
        <thead>
          <tr>
            <th>
              <UnstyledButton onClick={() => handleSort('taskOrder')}>
                <Group spacing={4}>
                  <Text size='sm' weight={600}>Task Order</Text>
                  {sortField === 'taskOrder' && (
                    sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                  )}
                </Group>
              </UnstyledButton>
            </th>
            <th>CLIN</th>
            <th>Task Title</th>
            <th>Type</th>
            <th>
              <UnstyledButton onClick={() => handleSort('month')}>
                <Group spacing={4}>
                  <Text size='sm' weight={600}>Month</Text>
                  {sortField === 'month' && (
                    sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                  )}
                </Group>
              </UnstyledButton>
            </th>
            <th>
              <UnstyledButton onClick={() => handleSort('plannedMarginPct')}>
                <Group spacing={4}>
                  <Text size='sm' weight={600}>Planned Margin %</Text>
                  {sortField === 'plannedMarginPct' && (
                    sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                  )}
                </Group>
              </UnstyledButton>
            </th>
            <th>Hist. Avg %</th>
            <th>
              <UnstyledButton onClick={() => handleSort('dollarImpact')}>
                <Group spacing={4}>
                  <Text size='sm' weight={600}>Dollar Impact</Text>
                  {sortField === 'dollarImpact' && (
                    sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                  )}
                </Group>
              </UnstyledButton>
            </th>
            <th>Flags</th>
          </tr>
        </thead>
        <tbody>
          {pageItems.map((job, idx) => {
            const isNegative = job.dollarImpact < 0;
            const isLowMargin =
              !isNegative &&
              job.plannedMarginPct >= 0 &&
              job.plannedMarginPct < LOW_MARGIN_THRESHOLD;
            const bg = isNegative
              ? 'red.9'
              : isLowMargin
                ? 'orange.9'
                : undefined;

            return (
              <tr key={idx} style={{ backgroundColor: bg ? undefined : undefined }}>
                <td>
                  <Text
                    size='sm'
                    bg={bg}
                    px={bg ? 'xs' : undefined}
                    sx={bg ? { borderRadius: 4 } : undefined}
                  >
                    {job.taskOrder}
                  </Text>
                </td>
                <td><Text size='sm'>{job.clin}</Text></td>
                <td><Text size='sm'>{job.taskTitle}</Text></td>
                <td><Text size='sm'>{job.type}</Text></td>
                <td><Text size='sm'>{job.month}</Text></td>
                <td>
                  <Text size='sm' color={isNegative ? 'red' : isLowMargin ? 'orange' : undefined}>
                    {job.plannedMarginPct.toFixed(1)}%
                  </Text>
                </td>
                <td>
                  <Text size='sm'>
                    {job.historicalAvgMarginPct !== null
                      ? `${job.historicalAvgMarginPct.toFixed(1)}%`
                      : '—'}
                  </Text>
                </td>
                <td>
                  <Text size='sm' color={isNegative ? 'red' : undefined}>
                    ${job.dollarImpact.toLocaleString('en-US', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </Text>
                </td>
                <td>
                  <Group spacing={4}>
                    {job.flags.map((flag) => (
                      <Badge key={flag} color={FLAG_COLORS[flag]} size='xs' variant='filled'>
                        {FLAG_LABELS[flag]}
                      </Badge>
                    ))}
                  </Group>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {totalPages > 1 && (
        <Pagination
          mt='md'
          value={page}
          onChange={setPage}
          total={totalPages}
          size='sm'
        />
      )}
    </>
    </Stack>
  );
}
