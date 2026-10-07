import { Card, Grid, Group, Skeleton, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconChartLine, IconPencil } from '@tabler/icons-react';
import { PromptStats, WorkflowStats } from '@/features/context-studio/types/context-studio';

type PromptsSectionProps = Readonly<{
  promptStats: PromptStats | undefined;
  promptStatsLoading: boolean;
  workflowStats: WorkflowStats | undefined;
  workflowStatsLoading: boolean;
}>;

export default function PromptsSection({
  promptStats,
  promptStatsLoading,
  workflowStats,
  workflowStatsLoading,
}: PromptsSectionProps) {
  if (!promptStatsLoading && !promptStats) {
    return null;
  }

  return (
    <Grid.Col span={6}>
      <Card shadow='sm' padding='md' radius='md' withBorder h='100%'>
        <Group spacing='xxs' mb='md'>
          <ThemeIcon variant='light' c='blue' sx={{ pointerEvents: 'none' }}>
            <IconPencil size={20} />
          </ThemeIcon>
          <Title order={4}>
            Prompts
          </Title>
        </Group>
        {promptStatsLoading ? (
          <Stack spacing='md'>
            <Skeleton height={100} />
            <Skeleton height={100} />
            <Skeleton height={40} />
          </Stack>
        ) : promptStats ? (
          <Stack spacing='md'>
            {/* Prompt Library Section */}
            <Stack spacing='xs'>
              <Text size='sm' weight={600} color='dimmed'>
                Prompt Library
              </Text>
              <Stack spacing={4} ml={8}>
                <Group position='apart'>
                  <Text size='xs'>
                    Created
                  </Text>
                  <Text size='sm' weight={600}>
                    {promptStats.library.created.toLocaleString()}
                  </Text>
                </Group>
                <Group position='apart'>
                  <Text size='xs'>
                    Started Chats
                  </Text>
                  <Text size='sm' weight={600}>
                    {promptStats.library.chatted.toLocaleString()}
                  </Text>
                </Group>
                <Group position='apart'>
                  <Text size='xs'>
                    Bookmarked
                  </Text>
                  <Text size='sm' weight={600}>
                    {promptStats.library.bookmarked.toLocaleString()}
                  </Text>
                </Group>
                <Group position='apart'>
                  <Text size='xs'>
                    Unique Tags
                  </Text>
                  <Text size='sm' weight={600}>
                    {promptStats.library.uniqueTags.toLocaleString()}
                  </Text>
                </Group>
              </Stack>
            </Stack>

            {/* Workflows Section */}
            <Stack spacing='xs'>
              <Text size='sm' weight={600} color='dimmed'>
                Workflows
              </Text>
              <Stack spacing={4} ml={8}>
                <Group position='apart'>
                  <Text size='xs'>
                    Created
                  </Text>
                  <Text size='sm' weight={600}>
                    {workflowStats ? workflowStats.total.toLocaleString() : workflowStatsLoading ? <Skeleton width={40} height={16} /> : '0'}
                  </Text>
                </Group>
                <Group position='apart'>
                  <Text size='xs'>
                    Executions
                  </Text>
                  <Text size='sm' weight={600}>
                    {workflowStats ? workflowStats.executions.toLocaleString() : workflowStatsLoading ? <Skeleton width={40} height={16} /> : '0'}
                  </Text>
                </Group>
              </Stack>
            </Stack>

            {/* App-wide LLM calls — not attributable to a library prompt or a
                workflow; see PromptStats.llmCalls. */}
            <Group position='apart' mt='xs' pt='xs' sx={(theme) => ({ borderTop: `1px solid ${theme.colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[3]}` })}>
              <Group spacing='xs'>
                <ThemeIcon size='sm' variant='light' color='green'>
                  <IconChartLine size={16} />
                </ThemeIcon>
                <Text size='xs' weight={500}>
                  LLM Calls (all surfaces)
                </Text>
              </Group>
              <Text size='lg' weight={700} color='green'>
                {promptStats.llmCalls.toLocaleString()}
              </Text>
            </Group>
          </Stack>
        ) : (
          <Text size='sm' color='dimmed'>
            No prompt data available
          </Text>
        )}
      </Card>
    </Grid.Col>
  );
}
