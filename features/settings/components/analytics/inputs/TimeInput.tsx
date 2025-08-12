import { Select } from '@mantine/core';

import { AnalyticsQuery, TimeRange } from '@/features/settings/types/analytics';
import { UseFormReturnType } from '@mantine/form';

type TimeInputProps = Readonly<{
  form: UseFormReturnType<AnalyticsQuery>;
}>

export default function TimeInput({ form }: TimeInputProps) {

  // Use Time Range enum values as data
  const timeRangeData = Object.values(TimeRange).map((timeRange) => timeRange);

  return (
    <Select
      label='Time Range'
      placeholder='Select time range'
      mb='0'
      data={timeRangeData}
      {...form.getInputProps('timeRange')}
    />
  );
}
