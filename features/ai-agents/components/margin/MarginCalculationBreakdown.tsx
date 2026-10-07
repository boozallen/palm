import { Divider, Group, Paper, Stack, Text } from '@mantine/core';
import type { FlaggedJob, MarginFlagType } from '@/features/ai-agents/types/margin';
import { DOLLAR_THRESHOLD, LOW_MARGIN_THRESHOLD, SWING_MULTIPLIER } from '@/features/ai-agents/utils/margin/analyzeMargins';

type Props = Readonly<{
  job: FlaggedJob;
}>;

function formatDollars(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function SectionLabel({ children }: { children: string; }) {
  return (
    <Text size='xs' color='dimmed' weight={600} transform='uppercase' mb='xs'>
      {children}
    </Text>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean; }) {
  return (
    <Group position='apart' noWrap>
      <Text size='sm' color='dimmed'>{label}</Text>
      <Text size='sm' weight={bold ? 600 : undefined} color={color}>{value}</Text>
    </Group>
  );
}

function FlagExplanation({ flag, job }: { flag: MarginFlagType; job: FlaggedJob; }) {
  const avg = job.historicalAvgMarginPct;
  const stdDev = job.historicalStdDev;

  switch (flag) {
    case 'ZERO_REVENUE':
      return (
        <Stack spacing='xs'>
          <SectionLabel>From FF Financials</SectionLabel>
          <Row label={`Revenue (cell ${job.revenueCell})`} value='$0' />
          <Divider />
          <Row label='No work billed — margin cannot be calculated' value='Flagged: Zero Revenue' color='gray.6' bold />
        </Stack>
      );

    case 'NEGATIVE_MARGIN':
      return (
        <Stack spacing='xs'>
          <SectionLabel>From FF Financials</SectionLabel>
          <Row label={`Revenue (cell ${job.revenueCell})`} value={formatDollars(job.revenue)} />
          <Row label={`Profit (cell ${job.profitCell})`} value={formatDollars(job.dollarImpact)} color='red.6' />
          <Divider />
          <SectionLabel>Margin calculation</SectionLabel>
          <Row label='Formula' value='Profit ÷ Revenue × 100' />
          <Row
            label={`${formatDollars(job.dollarImpact)} ÷ ${formatDollars(job.revenue)} × 100`}
            value={`${job.plannedMarginPct.toFixed(1)}%`}
            color='red.6'
            bold
          />
          <Divider />
          <Row label='Profit is negative' value='Flagged: Negative Margin' color='red.6' bold />
        </Stack>
      );

    case 'LOW_MARGIN':
      return (
        <Stack spacing='xs'>
          <SectionLabel>From FF Financials</SectionLabel>
          <Row label={`Revenue (cell ${job.revenueCell})`} value={formatDollars(job.revenue)} />
          <Row label={`Profit (cell ${job.profitCell})`} value={formatDollars(job.dollarImpact)} />
          <Divider />
          <SectionLabel>Margin calculation</SectionLabel>
          <Row label='Formula' value='Profit ÷ Revenue × 100' />
          <Row
            label={`${formatDollars(job.dollarImpact)} ÷ ${formatDollars(job.revenue)} × 100`}
            value={`${job.plannedMarginPct.toFixed(1)}%`}
            bold
          />
          <Divider />
          <SectionLabel>Threshold check</SectionLabel>
          <Row label='Low margin threshold' value={`${LOW_MARGIN_THRESHOLD}%`} />
          <Row label={`${job.plannedMarginPct.toFixed(1)}% < ${LOW_MARGIN_THRESHOLD}%`} value='Flagged: Low Margin' color='orange.6' bold />
        </Stack>
      );

    case 'SIGNIFICANT_DROP': {
      if (avg === null || stdDev === null) {
        return null;
      }
      const lowerBound = avg - SWING_MULTIPLIER * stdDev;
      return (
        <Stack spacing='xs'>
          <SectionLabel>From FF Financials — this month (planned)</SectionLabel>
          <Row label='Planned margin' value={`${job.plannedMarginPct.toFixed(1)}%`} />
          <Row label={`Dollar impact (cell ${job.profitCell})`} value={formatDollars(job.dollarImpact)} />
          <Divider />
          <SectionLabel>From FF Financials — historical actuals</SectionLabel>
          <Row label='Average margin across all actual months' value={`${avg.toFixed(1)}%`} />
          <Row label='Std dev (typical month-to-month variation)' value={`${stdDev.toFixed(1)}%`} />
          <Divider />
          <SectionLabel>Drop check</SectionLabel>
          <Row label='Formula' value={`avg − (${SWING_MULTIPLIER} × std dev)`} />
          <Row label={`${avg.toFixed(1)}% − (${SWING_MULTIPLIER} × ${stdDev.toFixed(1)}%)`} value={`${lowerBound.toFixed(1)}% (lower bound)`} />
          <Row label={`Planned ${job.plannedMarginPct.toFixed(1)}% < lower bound ${lowerBound.toFixed(1)}%`} value='Drop confirmed' color='yellow.7' bold />
          <Divider />
          <SectionLabel>Dollar threshold check</SectionLabel>
          <Row label='Minimum dollar impact required' value={formatDollars(DOLLAR_THRESHOLD)} />
          <Row label={`${formatDollars(Math.abs(job.dollarImpact))} ≥ ${formatDollars(DOLLAR_THRESHOLD)}`} value='Threshold met' color='yellow.7' bold />
          <Divider />
          <Row label='Margin dropped below normal range with material dollar impact' value='Flagged: Significant Drop' color='yellow.7' bold />
        </Stack>
      );
    }

    case 'SIGNIFICANT_SWING': {
      if (avg === null || stdDev === null) {
        return null;
      }
      const delta = Math.abs(job.plannedMarginPct - avg);
      const lowerBound = avg - SWING_MULTIPLIER * stdDev;
      const upperBound = avg + SWING_MULTIPLIER * stdDev;
      return (
        <Stack spacing='xs'>
          <SectionLabel>From FF Financials — this month (planned)</SectionLabel>
          <Row label='Planned margin' value={`${job.plannedMarginPct.toFixed(1)}%`} />
          <Row label={`Dollar impact (cell ${job.profitCell})`} value={formatDollars(job.dollarImpact)} />
          <Divider />
          <SectionLabel>From FF Financials — historical actuals</SectionLabel>
          <Row label='Average margin across all actual months' value={`${avg.toFixed(1)}%`} />
          <Row label='Std dev (typical month-to-month variation)' value={`${stdDev.toFixed(1)}%`} />
          <Divider />
          <SectionLabel>Swing check</SectionLabel>
          <Row label='Normal range formula' value={`avg ± (${SWING_MULTIPLIER} × std dev)`} />
          <Row label={`${avg.toFixed(1)}% ± ${stdDev.toFixed(1)}%`} value={`[${lowerBound.toFixed(1)}%, ${upperBound.toFixed(1)}%]`} />
          <Row label={`|${job.plannedMarginPct.toFixed(1)}% − ${avg.toFixed(1)}%| = ${delta.toFixed(1)}%`} value={`${delta.toFixed(1)}% > ${stdDev.toFixed(1)}% std dev`} />
          <Row label='Planned margin outside normal range' value='Swing confirmed' color='blue.6' bold />
          <Divider />
          <SectionLabel>Dollar threshold check</SectionLabel>
          <Row label='Minimum dollar impact required' value={formatDollars(DOLLAR_THRESHOLD)} />
          <Row label={`${formatDollars(Math.abs(job.dollarImpact))} ≥ ${formatDollars(DOLLAR_THRESHOLD)}`} value='Threshold met' color='blue.6' bold />
          <Divider />
          <Row label='Margin swung outside normal range with material dollar impact' value='Flagged: Significant Swing' color='blue.6' bold />
        </Stack>
      );
    }

    default:
      return null;
  }
}

const FLAG_TITLES: Record<MarginFlagType, string> = {
  NEGATIVE_MARGIN: 'Negative Margin',
  LOW_MARGIN: 'Low Margin',
  ZERO_REVENUE: 'Zero Revenue',
  SIGNIFICANT_DROP: 'Significant Drop',
  SIGNIFICANT_SWING: 'Significant Swing',
};

export default function MarginCalculationBreakdown({ job }: Props) {
  return (
    <Paper p='md' withBorder bg='white'>
      <Text size='sm' weight={600} mb='sm' color='dark.8'>
        How this was flagged
      </Text>
      <Stack spacing='md'>
        {job.flags.map((flag, idx) => (
          <div key={flag}>
            {idx > 0 && <Divider mb='md' />}
            <Text size='sm' weight={600} color='blue.8' mb='xs'>
              {FLAG_TITLES[flag]}
            </Text>
            <Stack spacing={4} style={{ paddingLeft: 12 }}>
              <FlagExplanation flag={flag} job={job} />
            </Stack>
          </div>
        ))}
      </Stack>
    </Paper>
  );
}
