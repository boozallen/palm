import { Badge, Group, Stack, Table, Text, UnstyledButton } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import type { MarginFlagType, TaskOrderSummary } from '@/features/ai-agents/types/margin';
import { LOW_MARGIN_THRESHOLD } from '@/features/ai-agents/utils/margin/analyzeMargins';

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
  summary: TaskOrderSummary;
  onSelectMonth: (month: string) => void;
}>;

function formatDollars(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function TaskOrderMonthsView({ summary, onSelectMonth }: Props) {
  const months = summary.months ?? [];

  if (months.length === 0) {
    return (
      <Text color='dimmed' size='sm'>
        No flagged months for this task order.
      </Text>
    );
  }

  return (
    <Stack spacing='md'>
      <Text size='sm' color='dimmed'>
        {months.length} flagged {months.length === 1 ? 'month' : 'months'} · click a month to see flagged CLINs
      </Text>

      <Table striped highlightOnHover withBorder withColumnBorders>
        <thead>
          <tr>
            <th><Text size='sm' weight={600}>Month</Text></th>
            <th><Text size='sm' weight={600}>Revenue</Text></th>
            <th><Text size='sm' weight={600}>Profit</Text></th>
            <th><Text size='sm' weight={600}>Net Margin %</Text></th>
            <th><Text size='sm' weight={600}>Flagged CLINs</Text></th>
            <th><Text size='sm' weight={600}>Flags</Text></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => {
            const totalRevenue = m.totalRevenue ?? 0;
            const netMarginPct = totalRevenue > 0 ? (m.totalDollarImpact / totalRevenue) * 100 : null;
            const isLoss = m.totalDollarImpact < 0;
            const isLowMargin = netMarginPct !== null && netMarginPct >= 0 && netMarginPct < LOW_MARGIN_THRESHOLD;
            const marginColor = isLoss ? 'red' : isLowMargin ? 'orange' : undefined;

            return (
              <tr
                key={m.month}
                onClick={() => onSelectMonth(m.month)}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  <Text size='sm' weight={600}>{m.month}</Text>
                </td>
                <td>
                  <Text size='sm'>
                    {totalRevenue > 0 ? formatDollars(totalRevenue) : '—'}
                  </Text>
                </td>
                <td>
                  <Text size='sm' weight={600} color={isLoss ? 'red' : undefined}>
                    {formatDollars(m.totalDollarImpact)}
                  </Text>
                </td>
                <td>
                  <Text size='sm' weight={600} color={marginColor}>
                    {netMarginPct !== null ? `${netMarginPct.toFixed(1)}%` : '—'}
                  </Text>
                </td>
                <td>
                  <Text size='sm'>{m.flaggedClins}</Text>
                </td>
                <td>
                  <Group spacing={4}>
                    {m.flagTypes.map((flag) => (
                      <Badge key={flag} color={FLAG_COLORS[flag]} size='xs' variant='filled'>
                        {FLAG_LABELS[flag]}
                      </Badge>
                    ))}
                  </Group>
                </td>
                <td>
                  <UnstyledButton>
                    <IconChevronRight size={14} />
                  </UnstyledButton>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Stack>
  );
}
