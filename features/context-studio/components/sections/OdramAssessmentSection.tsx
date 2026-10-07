import { Card, Grid, Progress, Skeleton, Stack, Text, Title } from '@mantine/core';
import { AiAgentStats } from '@/features/context-studio/types/context-studio';

type OdramAssessmentSectionProps = Readonly<{
  aiAgentStats: AiAgentStats | undefined;
  aiAgentStatsLoading: boolean;
}>;

export default function OdramAssessmentSection({
  aiAgentStats,
  aiAgentStatsLoading,
}: OdramAssessmentSectionProps) {
  if (aiAgentStatsLoading) {
    return (
      <Card shadow='sm' padding='lg' radius='md' withBorder>
        <Title order={4} mb='md'>
          ODRAM Assessment Jobs
        </Title>
        <Skeleton height={100} />
      </Card>
    );
  }

  if (!aiAgentStats || aiAgentStats.odramJobs === 0) {
    return null;
  }

  return (
    <Card shadow='sm' padding='lg' radius='md' withBorder>
      <Title order={4} mb='md'>
        ODRAM Assessment Jobs
      </Title>
      <Grid>
        <Grid.Col span={3}>
          <Stack spacing='xs'>
            <Text size='sm' color='dimmed'>
              Total Jobs
            </Text>
            <Text size='xl' weight={700}>
              {aiAgentStats.odramJobs.toLocaleString()}
            </Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={3}>
          <Stack spacing='xs'>
            <Text size='sm' color='dimmed'>
              Completed
            </Text>
            <Text size='xl' weight={700} color='teal'>
              {aiAgentStats.odramCompleted.toLocaleString()}
            </Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={3}>
          <Stack spacing='xs'>
            <Text size='sm' color='dimmed'>
              In Progress
            </Text>
            <Text size='xl' weight={700} color='cyan'>
              {aiAgentStats.odramInProgress.toLocaleString()}
            </Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={3}>
          <Stack spacing='xs'>
            <Text size='sm' color='dimmed'>
              Completion Rate
            </Text>
            <Text size='xl' weight={700}>
              {((aiAgentStats.odramCompleted / aiAgentStats.odramJobs) * 100).toFixed(1)}%
            </Text>
            <Progress
              value={(aiAgentStats.odramCompleted / aiAgentStats.odramJobs) * 100}
              size='lg'
              radius='xl'
              sx={(theme) => ({
                '& .mantine-Progress-bar': {
                  background: `linear-gradient(90deg, ${theme.colors.orange[5]}, ${theme.colors.yellow[5]})`,
                },
              })}
            />
          </Stack>
        </Grid.Col>
      </Grid>
    </Card>
  );
}
