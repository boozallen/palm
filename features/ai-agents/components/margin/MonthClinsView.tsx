import { Accordion, Badge, Divider, Group, Stack, Text } from '@mantine/core';
import type { FlaggedJob, MarginFlagType } from '@/features/ai-agents/types/margin';
import { LOW_MARGIN_THRESHOLD } from '@/features/ai-agents/utils/margin/analyzeMargins';
import MarginCalculationBreakdown from './MarginCalculationBreakdown';

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

const MONTH_ORDER: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function compareMonthStrings(a: string, b: string): number {
  const [aMonth, aYear] = a.split(' ');
  const [bMonth, bYear] = b.split(' ');
  const yearDiff = parseInt(aYear, 10) - parseInt(bYear, 10);
  if (yearDiff !== 0) {
    return yearDiff;
  }
  return (MONTH_ORDER[aMonth] ?? 0) - (MONTH_ORDER[bMonth] ?? 0);
}

type Props = Readonly<{
  taskOrder: string;
  flaggedJobs: FlaggedJob[];
}>;

export default function MonthClinsView({ taskOrder, flaggedJobs }: Props) {
  const clins = flaggedJobs.filter((j) => j.taskOrder === taskOrder);

  if (clins.length === 0) {
    return (
      <Text color='dimmed' size='sm'>
        No flagged CLINs for this task order.
      </Text>
    );
  }

  // Group by month, sorted chronologically
  const byMonth = new Map<string, FlaggedJob[]>();
  for (const job of clins) {
    const existing = byMonth.get(job.month) ?? [];
    existing.push(job);
    byMonth.set(job.month, existing);
  }
  const sortedMonths = [...byMonth.keys()].sort(compareMonthStrings);

  return (
    <Stack spacing='xl'>
      {sortedMonths.map((month, monthIdx) => {
        const monthClins = byMonth.get(month) ?? [];
        return (
          <Stack key={month} spacing='sm'>
            {monthIdx > 0 && <Divider />}
            <Group spacing='xs' align='center'>
              <Text size='sm' weight={700}>{month}</Text>
              <Text size='xs' color='dimmed'>
                {monthClins.length} flagged {monthClins.length === 1 ? 'CLIN' : 'CLINs'}
              </Text>
            </Group>

            <Accordion variant='contained'>
              {monthClins.map((job, idx) => {
                const isNegative = job.dollarImpact < 0;
                const isLowMargin =
                  !isNegative &&
                  job.plannedMarginPct >= 0 &&
                  job.plannedMarginPct < LOW_MARGIN_THRESHOLD;
                const marginColor = isNegative ? 'red' : isLowMargin ? 'orange' : undefined;

                return (
                  <Accordion.Item key={idx} value={`${month}-${idx}`}>
                    <Accordion.Control>
                      <Group position='apart' pr='md'>
                        <Group spacing='xs'>
                          <Text size='sm' fw={600} sx={{ fontFamily: 'monospace' }}>
                            {job.clin}
                          </Text>
                          <Text size='sm' color='dimmed'>·</Text>
                          <Text size='sm'>{job.taskTitle}</Text>
                          <Text size='sm' color='dimmed'>{job.type}</Text>
                        </Group>
                        <Group spacing='lg'>
                          <Stack spacing={0} align='flex-end' sx={{ minWidth: 100 }}>
                            <Text size='xs' color='dimmed'>Revenue</Text>
                            <Text size='sm'>
                              ${job.revenue.toLocaleString('en-US', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </Text>
                          </Stack>
                          <Stack spacing={0} align='flex-end' sx={{ minWidth: 70 }}>
                            <Text size='xs' color='dimmed'>Margin %</Text>
                            <Text size='sm' fw={600} color={marginColor}>
                              {job.plannedMarginPct.toFixed(1)}%
                            </Text>
                          </Stack>
                          <Stack spacing={0} align='flex-end' sx={{ minWidth: 80 }}>
                            <Text size='xs' color='dimmed'>Profit</Text>
                            <Text size='sm' fw={600} color={isNegative ? 'red' : undefined}>
                              ${job.dollarImpact.toLocaleString('en-US', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </Text>
                          </Stack>
                          <Stack spacing={4} align='flex-end' sx={{ minWidth: 110 }}>
                            {job.flags.map((flag) => (
                              <Badge key={flag} color={FLAG_COLORS[flag]} size='xs' variant='light'>
                                {FLAG_LABELS[flag]}
                              </Badge>
                            ))}
                          </Stack>
                        </Group>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <MarginCalculationBreakdown job={job} />
                    </Accordion.Panel>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          </Stack>
        );
      })}
    </Stack>
  );
}
