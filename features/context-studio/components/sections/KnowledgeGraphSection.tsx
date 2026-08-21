import { Card, Grid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { GraphStats } from '@/features/context-studio/types/context-studio';

type KnowledgeGraphSectionProps = Readonly<{
  graphStats: GraphStats | undefined;
  graphStatsLoading: boolean;
}>;

export default function KnowledgeGraphSection({
  graphStats,
  graphStatsLoading,
}: KnowledgeGraphSectionProps) {
  if (!graphStatsLoading && (!graphStats || graphStats.graphsBuilt === 0)) {
    return null;
  }

  if (graphStatsLoading) {
    return (
      <Card shadow='sm' padding='lg' radius='md' withBorder>
        <Title order={4} mb='md'>
          Knowledge Graph Statistics
        </Title>
        <Skeleton height={100} />
      </Card>
    );
  }

  if (!graphStats) {
    return null;
  }

  return (
    <Card shadow='sm' padding='lg' radius='md' withBorder>
      <Title order={4} mb='md'>
        Knowledge Graph Statistics
      </Title>
      <Grid>
        <Grid.Col span={4}>
          <Stack spacing='xs'>
            <Text size='sm' color='dimmed'>
              Graphs Built
            </Text>
            <Text size='xl' weight={700} color='violet'>
              {graphStats.graphsBuilt.toLocaleString()}
            </Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={4}>
          <Stack spacing='xs'>
            <Text size='sm' color='dimmed'>
              Total Entities
            </Text>
            <Text size='xl' weight={700} color='indigo'>
              {graphStats.entities.toLocaleString()}
            </Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={4}>
          <Stack spacing='xs'>
            <Text size='sm' color='dimmed'>
              Total Concepts
            </Text>
            <Text size='xl' weight={700} color='grape'>
              {graphStats.concepts.toLocaleString()}
            </Text>
          </Stack>
        </Grid.Col>
      </Grid>
    </Card>
  );
}
