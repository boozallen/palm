import { useMemo, useState } from 'react';
import { Badge, Button, Group, Pagination, Stack, Table, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconChevronUp } from '@tabler/icons-react';
import type { MarginFlagType, TaskOrderSummary } from '@/features/ai-agents/types/margin';
import { DOLLAR_THRESHOLD, LOW_MARGIN_THRESHOLD, SWING_MULTIPLIER } from '@/features/ai-agents/utils/margin/analyzeMargins';

const FLAG_COLORS: Record<MarginFlagType, string> = {
  NEGATIVE_MARGIN: 'red',
  LOW_MARGIN: 'orange',
  ZERO_REVENUE: 'gray',
  SIGNIFICANT_DROP: 'yellow',
  SIGNIFICANT_SWING: 'blue',
};

const FLAG_LABELS: Record<MarginFlagType, string> = {
  NEGATIVE_MARGIN: 'Losing Money',
  LOW_MARGIN: 'Thin Margin',
  ZERO_REVENUE: 'Not Billed',
  SIGNIFICANT_DROP: 'Margin Dropped',
  SIGNIFICANT_SWING: 'Unusual Swing',
};

const PAGE_SIZE = 20;

type FilterType = 'all' | 'losses' | 'low_margin' | 'pattern_changes';
type SortField = 'taskOrder' | 'revenue' | 'profit' | 'netMargin';
type SortDirection = 'asc' | 'desc';

type Props = Readonly<{
  summaries: TaskOrderSummary[];
  onSelect: (taskOrder: string) => void;
}>;

function formatDollars(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function TaskOrderSummaryTable({ summaries, onSelect }: Props) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortField, setSortField] = useState<SortField>('profit');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleFilter = (f: FilterType) => {
    setFilter(f);
    setPage(1);
    // Auto-set a sensible default sort per category
    if (f === 'low_margin') {
      setSortField('netMargin');
      setSortDirection('asc');
    } else {
      setSortField('profit');
      setSortDirection('asc');
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'profit' || field === 'netMargin' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const filteredSummaries = useMemo(() => {
    switch (filter) {
      case 'losses':
        return summaries.filter((s) =>
          s.flagTypes.includes('NEGATIVE_MARGIN') || s.flagTypes.includes('ZERO_REVENUE'),
        );
      case 'low_margin':
        return summaries.filter((s) => s.flagTypes.includes('LOW_MARGIN'));
      case 'pattern_changes':
        return summaries.filter((s) =>
          s.flagTypes.includes('SIGNIFICANT_DROP') || s.flagTypes.includes('SIGNIFICANT_SWING'),
        );
      default:
        return summaries;
    }
  }, [summaries, filter]);

  const sortedSummaries = useMemo(() => {
    return [...filteredSummaries].sort((a, b) => {
      const aRevenue = a.totalRevenue ?? 0;
      const bRevenue = b.totalRevenue ?? 0;
      const aNetMargin = aRevenue > 0 ? (a.totalDollarImpact / aRevenue) * 100 : 0;
      const bNetMargin = bRevenue > 0 ? (b.totalDollarImpact / bRevenue) * 100 : 0;

      let comparison = 0;
      switch (sortField) {
        case 'taskOrder':
          comparison = a.taskOrder.localeCompare(b.taskOrder);
          break;
        case 'revenue':
          comparison = aRevenue - bRevenue;
          break;
        case 'profit':
          comparison = a.totalDollarImpact - b.totalDollarImpact;
          break;
        case 'netMargin':
          comparison = aNetMargin - bNetMargin;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredSummaries, sortField, sortDirection]);

  const counts = useMemo(() => ({
    all: summaries.length,
    losses: summaries.filter((s) =>
      s.flagTypes.includes('NEGATIVE_MARGIN') || s.flagTypes.includes('ZERO_REVENUE'),
    ).length,
    low_margin: summaries.filter((s) => s.flagTypes.includes('LOW_MARGIN')).length,
    pattern_changes: summaries.filter((s) =>
      s.flagTypes.includes('SIGNIFICANT_DROP') || s.flagTypes.includes('SIGNIFICANT_SWING'),
    ).length,
  }), [summaries]);

  if (summaries.length === 0) {
    return (
      <Text color='dimmed' size='sm'>
        No task orders with flagged CLINs found.
      </Text>
    );
  }

  const totalPages = Math.ceil(sortedSummaries.length / PAGE_SIZE);
  const pageItems = sortedSummaries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />;
  }

  function SortableHeader({ field, children }: { field: SortField; children: string }) {
    return (
      <UnstyledButton onClick={() => handleSort(field)}>
        <Group spacing={4}>
          <Text size='sm' weight={600}>{children}</Text>
          <SortIcon field={field} />
        </Group>
      </UnstyledButton>
    );
  }

  return (
    <Stack spacing='md'>
      {/* Filter bar */}
      <Stack spacing={6}>
        <Group spacing='xs'>
          <Button
            size='xs'
            variant={filter === 'all' ? 'filled' : 'light'}
            color='gray'
            onClick={() => handleFilter('all')}
          >
            All ({counts.all})
          </Button>
          <Tooltip
            label='Profit is negative — costs exceed revenue for that month.'
            width={260}
            multiline
            withArrow
          >
            <Button
              size='xs'
              variant={filter === 'losses' ? 'filled' : 'light'}
              color='red'
              onClick={() => handleFilter('losses')}
            >
              Losing Money ({counts.losses})
            </Button>
          </Tooltip>
          <Tooltip
            label={`Margin is between 0% and ${LOW_MARGIN_THRESHOLD}% — profitable but below the minimum threshold.`}
            width={280}
            multiline
            withArrow
          >
            <Button
              size='xs'
              variant={filter === 'low_margin' ? 'filled' : 'light'}
              color='orange'
              onClick={() => handleFilter('low_margin')}
            >
              Thin Margin ({counts.low_margin})
            </Button>
          </Tooltip>
          <Tooltip
            label={`Planned margin deviates more than ${SWING_MULTIPLIER} standard deviation from that contract's own historical average, with at least $${(DOLLAR_THRESHOLD / 1000).toFixed(0)}k in dollar impact. Requires at least 2 months of actuals to calculate.`}
            width={320}
            multiline
            withArrow
          >
            <Button
              size='xs'
              variant={filter === 'pattern_changes' ? 'filled' : 'light'}
              color='blue'
              onClick={() => handleFilter('pattern_changes')}
            >
              Pattern Changes ({counts.pattern_changes})
            </Button>
          </Tooltip>
        </Group>
      </Stack>

      {filteredSummaries.length === 0 ? (
        <Text color='dimmed' size='sm'>No task orders in this category.</Text>
      ) : (
        <>
          <Table striped highlightOnHover withBorder withColumnBorders>
            <thead>
              <tr>
                <th><Text size='sm' weight={600}>Why Flagged</Text></th>
                <th><SortableHeader field='taskOrder'>Task Order</SortableHeader></th>
                <th>
                  <SortableHeader field='revenue'>Revenue</SortableHeader>
                  <Text size='xs' color='dimmed'>all planned months</Text>
                </th>
                <th>
                  <SortableHeader field='profit'>Profit</SortableHeader>
                  <Text size='xs' color='dimmed'>all planned months</Text>
                </th>
                <th>
                  <SortableHeader field='netMargin'>Net Margin %</SortableHeader>
                  <Text size='xs' color='dimmed'>all planned months</Text>
                </th>
                <th><Text size='sm' weight={600}>Flagged CLINs</Text></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((summary, idx) => {
                const totalRevenue = summary.totalRevenue ?? 0;
                const netMarginPct = totalRevenue > 0
                  ? (summary.totalDollarImpact / totalRevenue) * 100
                  : null;
                const isLoss = summary.totalDollarImpact < 0;
                const isLowMargin = netMarginPct !== null && netMarginPct >= 0 && netMarginPct < LOW_MARGIN_THRESHOLD;
                const marginColor = isLoss ? 'red' : isLowMargin ? 'orange' : undefined;

                return (
                  <tr key={idx}>
                    <td style={{ minWidth: 140 }}>
                      <Stack spacing={4}>
                        {summary.flagTypes.map((flag) => (
                          <Badge key={flag} color={FLAG_COLORS[flag]} size='sm' variant='light'>
                            {FLAG_LABELS[flag]}
                          </Badge>
                        ))}
                      </Stack>
                    </td>
                    <td>
                      <Text size='sm' weight={600} sx={{ fontFamily: 'monospace' }}>
                        {summary.taskOrder}
                      </Text>
                      <Text size='xs' color='dimmed'>{summary.taskTitle}</Text>
                      <Text size='xs' color='dimmed'>
                        {(summary.months ?? []).length} of {summary.totalFutureMonths ?? '?'} months flagged
                        {summary.lastPlannedMonth ? ` · through ${summary.lastPlannedMonth}` : ''}
                      </Text>
                    </td>
                    <td>
                      <Text size='sm'>
                        {totalRevenue > 0 ? formatDollars(totalRevenue) : '—'}
                      </Text>
                    </td>
                    <td>
                      <Text size='sm' weight={600} color={isLoss ? 'red' : undefined}>
                        {formatDollars(summary.totalDollarImpact)}
                      </Text>
                    </td>
                    <td>
                      <Text size='sm' weight={600} color={marginColor}>
                        {netMarginPct !== null ? `${netMarginPct.toFixed(1)}%` : '—'}
                      </Text>
                    </td>
                    <td>
                      <UnstyledButton onClick={() => onSelect(summary.taskOrder)}>
                        <Group spacing={4} noWrap>
                          <Text size='sm' weight={600} color='blue'>
                            {summary.flaggedClins} {summary.flaggedClins === 1 ? 'CLIN' : 'CLINs'}
                          </Text>
                          <IconChevronRight size={14} color='var(--mantine-color-blue-6)' />
                        </Group>
                      </UnstyledButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          {totalPages > 1 && (
            <Pagination value={page} onChange={setPage} total={totalPages} size='sm' />
          )}
        </>
      )}
    </Stack>
  );
}
