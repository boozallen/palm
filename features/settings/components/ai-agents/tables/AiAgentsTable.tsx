import { Box, Table, Text } from '@mantine/core';
import Loading from '@/features/shared/components/Loading';
import useGetAiAgents from '@/features/settings/api/ai-agents/get-ai-agents';
import AiAgentsRow from '@/features/settings/components/ai-agents/tables/AiAgentsRow';

export default function AiAgentsTable() {
  const {
    data: aiAgentsData,
    isPending: getAiAgentsIsPending,
    error: getAiAgentsIsError,
  } = useGetAiAgents();

  if (getAiAgentsIsPending) {
    return <Loading />;
  }

  if (getAiAgentsIsError) {
    return <Text>{getAiAgentsIsError?.message}</Text>;
  }

  if (!aiAgentsData.aiAgents?.length) {
    return (
      <Box bg='dark.8' p='md'>
        <Text c='gray.4'>No AI Agents have been configured yet.</Text>
      </Box>
    );
  }

  return (
    <Box bg='dark.6' p='xl'>
      <Table data-testid='ai-agents-table' aria-label='List of AI Agents'>
        <thead>
          <tr>
            <th>AI Agent</th>
            <th>Requirements</th>
            <th>Enabled</th>
          </tr>
        </thead>
        <tbody>
          {aiAgentsData.aiAgents.map((agent) => (
            <AiAgentsRow
              key={agent.id}
              id={agent.id}
              name={agent.name}
              description={agent.description}
              enabled={agent.enabled}
            />
          ))}
        </tbody>
      </Table>
    </Box>
  );
}
