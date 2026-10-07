import { Stack, Title } from '@mantine/core';

import UiPreferencesTable from './tables/UiPreferencesTable';

export default function General() {

  return (
    <Stack spacing='md' p='md' bg='dark.6'>
      <Title weight='bold' color='gray.6' order={2}>
        General Settings
      </Title>
      <UiPreferencesTable />
    </Stack>
  );
}
