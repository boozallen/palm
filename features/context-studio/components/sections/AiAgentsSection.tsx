import { Card, Grid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { AiAgentStats } from '@/features/context-studio/types/context-studio';

type AiAgentsSectionProps = Readonly<{
  aiAgentStats: AiAgentStats | undefined;
  aiAgentStatsLoading: boolean;
}>;

export default function AiAgentsSection({
  aiAgentStats,
  aiAgentStatsLoading,
}: AiAgentsSectionProps) {
  if (!aiAgentStatsLoading && (!aiAgentStats || (aiAgentStats.configured === 0 && aiAgentStats.prismJobs === 0 && aiAgentStats.odramJobs === 0 && aiAgentStats.marginAnalyses === 0))) {
    return null;
  }

  if (aiAgentStatsLoading) {
    return (
      <Grid.Col span={6}>
        <Card shadow='sm' padding='lg' radius='md' withBorder h='100%'>
          <Title order={3} mb='md'>
            AI Agents
          </Title>
          <Skeleton height={100} />
        </Card>
      </Grid.Col>
    );
  }

  if (!aiAgentStats) {
    return null;
  }

  return (
    <Grid.Col span={6}>
      <Card shadow='sm' padding='lg' radius='md' withBorder h='100%'>
        <Title order={3} mb='md'>
          AI Agents
        </Title>
        <Grid>
          <Grid.Col span={4}>
            <Stack spacing='xs'>
              <Text size='sm' color='dimmed'>
                Agents Configured
              </Text>
              <Text size='xl' weight={700} color='violet'>
                {aiAgentStats.configured.toLocaleString()}
              </Text>
            </Stack>
          </Grid.Col>
          <Grid.Col span={4}>
            <Stack spacing='xs'>
              <Text size='sm' color='dimmed'>
                Reports Generated
              </Text>
              <Text size='xl' weight={700} color='teal'>
                {aiAgentStats.reportsGenerated.toLocaleString()}
              </Text>
            </Stack>
          </Grid.Col>
          <Grid.Col span={4}>
            <Stack spacing='xs'>
              <Text size='sm' color='dimmed'>
                Unique Users
              </Text>
              <Text size='xl' weight={700} color='cyan'>
                {aiAgentStats.uniqueUsers.toLocaleString()}
              </Text>
            </Stack>
          </Grid.Col>
        </Grid>
      </Card>
    </Grid.Col>
  );
}
