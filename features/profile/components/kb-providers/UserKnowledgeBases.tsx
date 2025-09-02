import { Stack, Title } from '@mantine/core';

import UserKbProvidersTable from './tables/UserKbProvidersTable';
import AdvancedKbSettingsTable from './tables/AdvancedKbSettingsTable';

export default function UserKnowledgeBases() {

  return (
    <Stack spacing='md' p='xl' bg='dark.6'>
      <Title weight='bold' color='gray.6' order={2}>
        My Knowledge Bases
      </Title>
      <UserKbProvidersTable />
      <AdvancedKbSettingsTable />
    </Stack>
  );
}
