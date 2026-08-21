import { Badge, Box, Card, Group, Progress, Skeleton, Stack, Text, Title } from '@mantine/core';
import { PromptStats } from '@/features/context-studio/types/context-studio';

type AiProvidersSectionProps = Readonly<{
  promptStats: PromptStats | undefined;
  promptStatsLoading: boolean;
}>;

export default function AiProvidersSection({
  promptStats,
  promptStatsLoading,
}: AiProvidersSectionProps) {
  if (promptStatsLoading) {
    return (
      <Card shadow='sm' padding='lg' radius='md' withBorder>
        <Title order={4} mb='xs'>
          AI Providers
        </Title>
        <Text size='sm' color='dimmed' mb='md'>
          All LLM calls by provider, operation type, and model (includes user-initiated and system-automated calls like conversation summaries)
        </Text>
        <Stack spacing='md'>
          {[...Array(5)].map((_, index) => (
            <Skeleton key={index} height={60} />
          ))}
        </Stack>
      </Card>
    );
  }

  if (!promptStats || promptStats.llmCallsBySource.length === 0) {
    return null;
  }

  return (
    <Card shadow='sm' padding='lg' radius='md' withBorder>
      <Title order={4} mb='xs'>
        AI Providers
      </Title>
      <Text size='sm' color='dimmed' mb='md'>
        All LLM calls by provider, operation type, and model (includes user-initiated and system-automated calls like conversation summaries)
      </Text>
      <Stack spacing='md'>
        {promptStats.llmCallsBySource.map((item, index) => {
          const percentage = promptStats.llmCalls > 0
            ? (item.count / promptStats.llmCalls) * 100
            : 0;
          const colors = ['teal', 'violet', 'orange', 'cyan', 'pink', 'indigo'];
          const color = colors[index % colors.length];

          return (
            <Box key={`${item.source}-${item.method}-${item.model}`}>
              <Group position='apart' mb='xs'>
                <Group spacing='xs'>
                  <Text size='sm' weight={500}>
                    {item.source}
                  </Text>
                  <Badge size='sm' variant='outline'>
                    {item.method}
                  </Badge>
                  {item.model && item.model !== 'Unknown' && (
                    <Badge size='sm' variant='filled' color={color}>
                      {item.model}
                    </Badge>
                  )}
                </Group>
                <Text size='sm' weight={700}>
                  {item.count.toLocaleString()} ({percentage.toFixed(1)}%)
                </Text>
              </Group>
              <Progress
                value={percentage}
                size='lg'
                radius='xl'
                color={color}
                sx={(theme) => ({
                  '& .mantine-Progress-bar': {
                    background: `linear-gradient(90deg, ${theme.colors[color][5]}, ${theme.colors[color][7]})`,
                  },
                })}
              />
            </Box>
          );
        })}
      </Stack>
    </Card>
  );
}
