import { useMemo, useState } from 'react';
import { Button, Group, Stack, Table, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import type { TmProfitRow } from '@/features/ai-agents/types/margin';
import { LOW_MARGIN_THRESHOLD } from '@/features/ai-agents/utils/margin/analyzeMargins';

type SortField = 'taskOrder' | 'month' | 'revenue' | 'profit' | 'marginPct';
type SortDirection = 'asc' | 'desc';
type ContractTypeFilter = 'all' | 'tm-only';
type ProfitFilter = 'all' | 'low-negative';

type Props = Readonly<{
  rows: TmProfitRow[];
}>;

export default function TmProfitTable({ rows }: Props) {
  const [sortField, setSortField] = useState<SortField>('profit');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [contractTypeFilter, setContractTypeFilter] = useState<ContractTypeFilter>('all');
  const [profitFilter, setProfitFilter] = useState<ProfitFilter>('all');

  const filteredRows = useMemo(() => {
    let filtered = [...rows];

    if (contractTypeFilter === 'tm-only') {
      filtered = filtered.filter((r) => r.type === 'T&M');
    }

    if (profitFilter === 'low-negative') {
      filtered = filtered.filter((r) => r.profit < 0 || r.marginPct < LOW_MARGIN_THRESHOLD);
    }

    return filtered;
  }, [rows, contractTypeFilter, profitFilter]);

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'taskOrder':
          comparison = a.taskOrder.localeCompare(b.taskOrder);
          break;
        case 'month':
          comparison = a.month.localeCompare(b.month);
          break;
        case 'revenue':
          comparison = a.revenue - b.revenue;
          break;
        case 'profit':
          comparison = a.profit - b.profit;
          break;
        case 'marginPct':
          comparison = a.marginPct - b.marginPct;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [filteredRows, sortField, sortDirection]);

  if (rows.length === 0) {
    return (
      <Text color='dimmed' size='sm'>
        No T&amp;M or FFP future rows found.
      </Text>
    );
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'profit' || field === 'marginPct' ? 'asc' : 'desc');
    }
  };

  return (
    <Stack spacing='md'>
      <Group spacing='lg'>
        <Group spacing='xs'>
          <Text size='sm' weight={600}>
            Contract Type:
          </Text>
          <Button
            size='xs'
            variant={contractTypeFilter === 'all' ? 'filled' : 'outline'}
            onClick={() => setContractTypeFilter('all')}
          >
            T&amp;M + FFP
          </Button>
          <Button
            size='xs'
            variant={contractTypeFilter === 'tm-only' ? 'filled' : 'outline'}
            onClick={() => setContractTypeFilter('tm-only')}
          >
            T&amp;M Only
          </Button>
        </Group>

        <Group spacing='xs'>
          <Text size='sm' weight={600}>
            Profit:
          </Text>
          <Button
            size='xs'
            variant={profitFilter === 'all' ? 'filled' : 'outline'}
            onClick={() => setProfitFilter('all')}
          >
            All
          </Button>
          <Button
            size='xs'
            variant={profitFilter === 'low-negative' ? 'filled' : 'outline'}
            onClick={() => setProfitFilter('low-negative')}
          >
            Low/Negative Only
          </Button>
        </Group>

        <Text size='sm' color='dimmed'>
          Showing {sortedRows.length} of {rows.length} rows
        </Text>
      </Group>

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
            <UnstyledButton onClick={() => handleSort('revenue')}>
              <Group spacing={4}>
                <Text size='sm' weight={600}>Revenue</Text>
                {sortField === 'revenue' && (
                  sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                )}
              </Group>
            </UnstyledButton>
          </th>
          <th>
            <UnstyledButton onClick={() => handleSort('profit')}>
              <Group spacing={4}>
                <Text size='sm' weight={600}>Profit</Text>
                {sortField === 'profit' && (
                  sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                )}
              </Group>
            </UnstyledButton>
          </th>
          <th>
            <UnstyledButton onClick={() => handleSort('marginPct')}>
              <Group spacing={4}>
                <Text size='sm' weight={600}>Margin %</Text>
                {sortField === 'marginPct' && (
                  sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                )}
              </Group>
            </UnstyledButton>
          </th>
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row, idx) => {
          const isNegative = row.profit < 0;
          return (
            <tr key={idx}>
              <td><Text size='sm'>{row.taskOrder}</Text></td>
              <td><Text size='sm'>{row.clin}</Text></td>
              <td><Text size='sm'>{row.taskTitle}</Text></td>
              <td><Text size='sm'>{row.type}</Text></td>
              <td><Text size='sm'>{row.month}</Text></td>
              <td>
                <Text size='sm'>
                  ${row.revenue.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </Text>
              </td>
              <td>
                <Text size='sm' color={isNegative ? 'red' : undefined}>
                  ${row.profit.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </Text>
              </td>
              <td>
                <Text size='sm' color={isNegative ? 'red' : undefined}>
                  {row.marginPct.toFixed(1)}%
                </Text>
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
    </Stack>
  );
}
