import { Select } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';

import { AnalyticsQuery, InitiatedBy } from '@/features/settings/types/analytics';

type InitiatedByInputProps = Readonly<{
  form: UseFormReturnType<AnalyticsQuery>;
}>

export default function InitiatedByInput({ form }: InitiatedByInputProps) {

  return (
    <Select
      label='Initiated By'
      placeholder='Select what initiated the AI call'
      mb='0'
      data={Object.values(InitiatedBy)}
      {...form.getInputProps('initiatedBy')}
    />
  );
}
