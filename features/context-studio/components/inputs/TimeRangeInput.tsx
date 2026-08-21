import { Select } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { TimeRange } from '@/features/context-studio/types/context-studio';

// Generic over the form so the dashboard filters and the Cost tab share one
// component; both carry a `timeRange` drawn from the same enum.
type TimeRangeInputProps<T extends { timeRange: TimeRange }> = Readonly<{
  form: UseFormReturnType<T>;
}>;

// Labels state the rolling window explicitly. The previous 'This Week' / 'This
// Month' / 'This Year' wording read as calendar-to-date while the queries have
// always been rolling 7/30/365-day windows — a gap that only became misleading
// once 'Year to Date', which really is calendar-anchored, joined the same list.
const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  [TimeRange.Day]: 'Last 24 Hours',
  [TimeRange.Week]: 'Last 7 Days',
  [TimeRange.Month]: 'Last 30 Days',
  [TimeRange.Year]: 'Last 365 Days',
  [TimeRange.YearToDate]: 'Year to Date',
  [TimeRange.Forever]: 'All Time',
};

export default function TimeRangeInput<T extends { timeRange: TimeRange }>(
  { form }: TimeRangeInputProps<T>,
) {
  const timeRangeData = Object.values(TimeRange).map((value) => ({
    value,
    label: TIME_RANGE_LABELS[value],
  }));

  return (
    <Select
      label='Time Range'
      mb='0'
      placeholder='Select time range'
      data={timeRangeData}
      data-testid='context-studio-time-range-input'
      {...form.getInputProps('timeRange')}
    />
  );
}

export { TIME_RANGE_LABELS };
