import { Card, Grid, Progress, Skeleton, Stack, Text, Title } from '@mantine/core';
import { WorkflowStats } from '@/features/context-studio/types/context-studio';

type WorkflowSharingSectionProps = Readonly<{
  workflowStats: WorkflowStats | undefined;
  workflowStatsLoading: boolean;
}>;

export default function WorkflowSharingSection({
  workflowStats,
  workflowStatsLoading,
}: WorkflowSharingSectionProps) {
  if (!workflowStatsLoading && (!workflowStats || workflowStats.shared === 0)) {
    return null;
  }

  if (workflowStatsLoading) {
    return (
      <Card shadow='sm' padding='lg' radius='md' withBorder>
        <Title order={4} mb='md'>
          Workflow Sharing
        </Title>
        <Skeleton height={100} />
      </Card>
    );
  }

  if (!workflowStats) {
    return null;
  }

  return (
    <Card shadow='sm' padding='lg' radius='md' withBorder>
      <Title order={4} mb='md'>
        Workflow Sharing
      </Title>
      <Grid>
        <Grid.Col span={3}>
          <Stack spacing='xs'>
            <Text size='sm' color='dimmed'>
              Workflows Shared
            </Text>
            <Text size='xl' weight={700}>
              {workflowStats.shared.toLocaleString()}
            </Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={3}>
          <Stack spacing='xs'>
            <Text size='sm' color='dimmed'>
              Accepted
            </Text>
            <Text size='xl' weight={700} color='teal'>
              {workflowStats.accepted.toLocaleString()}
            </Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={3}>
          <Stack spacing='xs'>
            <Text size='sm' color='dimmed'>
              Rejected
            </Text>
            <Text size='xl' weight={700} color='red'>
              {workflowStats.rejected.toLocaleString()}
            </Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={3}>
          <Stack spacing='xs'>
            <Text size='sm' color='dimmed'>
              Acceptance Rate
            </Text>
            <Text size='xl' weight={700}>
              {((workflowStats.accepted / workflowStats.shared) * 100).toFixed(1)}%
            </Text>
            <Progress
              value={(workflowStats.accepted / workflowStats.shared) * 100}
              size='lg'
              radius='xl'
              sx={(theme) => ({
                '& .mantine-Progress-bar': {
                  background: `linear-gradient(90deg, ${theme.colors.cyan[5]}, ${theme.colors.teal[5]})`,
                },
              })}
            />
          </Stack>
        </Grid.Col>
      </Grid>
    </Card>
  );
}
