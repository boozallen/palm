import { SimpleGrid, Text, Box } from '@mantine/core';
import AgentCard from './AgentCard';
import { AiAgent } from '@/features/shared/types/ai-agent';

type AiAgentsProps = Readonly<{
  agents?: AiAgent[];
}>;

export default function AiAgents({ agents }: AiAgentsProps) {
  if (!agents || agents.length === 0) {
    return (
      <Box bg='dark.9' p='md' m='xl'>
        <Text>No AI Agents have been configured yet.</Text>
      </Box>
    );
  }

  return (
    <SimpleGrid
      cols={4}
      breakpoints={[
        { maxWidth: 'xl', cols: 3, spacing: 'lg' },
        { maxWidth: 'lg', cols: 2, spacing: 'lg' },
        { maxWidth: 'md', cols: 2, spacing: 'lg' },
        { maxWidth: 'sm', cols: 1, spacing: 'lg' },
      ]}
      spacing='lg'
      verticalSpacing='lg'
      p='lg'
    >
      {agents.map((agent) => (
        <AgentCard key={agent.id} id={agent.id} name={agent.name} description={agent.description} />
      ))}
    </SimpleGrid>
  );
}
