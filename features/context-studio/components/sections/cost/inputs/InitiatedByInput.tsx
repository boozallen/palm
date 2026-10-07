import { Select } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';

import { CostQuery, InitiatedBy } from '@/features/context-studio/types/cost';

type InitiatedByInputProps = Readonly<{
  form: UseFormReturnType<CostQuery>;
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
