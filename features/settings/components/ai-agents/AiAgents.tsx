import { Stack, Title } from '@mantine/core';
import AiAgentsTable from '@/features/settings/components/ai-agents/tables/AiAgentsTable';

export default function AiAgents() {
  return (
    <Stack spacing='md'>
      <Title weight='bold' color='gray.6' order={2}>
        AI Agents
      </Title>

      <AiAgentsTable />
    </Stack>
  );
}
