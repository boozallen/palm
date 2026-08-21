import { Stack } from '@mantine/core';
import DatabasesTable from './tables/DatabasesTable';

export default function Databases() {
  return (
    <Stack spacing='md'>
      <DatabasesTable />
    </Stack>
  );
}
