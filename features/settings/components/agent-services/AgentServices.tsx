import { Group, Stack, Title } from '@mantine/core';
import AgentServicesTable from './tables/AgentServicesTable';

export default function AgentServices() {
  return (
    <Stack spacing='md'>
      <Group spacing='sm'>
        <Title weight='bold' color='gray.6' order={2}>
          Agent Services
        </Title>
      </Group>

      <AgentServicesTable />
    </Stack>
  );
}
