import { SimpleGrid, Stack, Text, Title } from '@mantine/core';
import AiAgents from '@/features/ai-agents/components/AiAgents';
import Loading from '@/features/shared/components/Loading';
import useGetAvailableAgents from '@/features/shared/api/get-available-agents';

export default function AiAgentsPage() {
 
  const {
    data,
    isPending: availableAgentsIsLoading,
  } = useGetAvailableAgents();

  if (availableAgentsIsLoading) {
    return <Loading />;
  }

  const availableAgents = data?.availableAgents;

  return (
    <>
      <SimpleGrid cols={2} p='xl' bg='dark.6'>
        <Stack spacing='xxs'>
          <Title fz='xxl' order={1} align='left' color='gray.1'>
            AI Agents
          </Title>
          <Text fz='md' c='gray.6'>
            Purpose-built AI agents engineered for specialized tasks
          </Text>
        </Stack>
      </SimpleGrid>
      <AiAgents agents={availableAgents} />
    </>
  );
}
