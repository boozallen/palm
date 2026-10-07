import { Box, Card, Grid, Group, RingProgress, Skeleton, Stack, Text, Title } from '@mantine/core';
import { PromptStats } from '@/features/context-studio/types/context-studio';

type PromptTagsSectionProps = Readonly<{
  promptStats: PromptStats | undefined;
  promptStatsLoading: boolean;
}>;

const getArtifactColor = (index: number) => {
  const colors = [
    'cyan', 'violet', 'orange', 'pink', 'teal', 'indigo', 'grape',
    'lime', 'yellow', 'blue', 'red', 'green', 'gray',
  ];
  return colors[index % colors.length];
};

export default function PromptTagsSection({
  promptStats,
  promptStatsLoading,
}: PromptTagsSectionProps) {
  if (!promptStatsLoading && (!promptStats || promptStats.library.byTag.length === 0)) {
    return null;
  }

  if (promptStatsLoading) {
    return (
      <Grid.Col span={6}>
        <Card shadow='sm' padding='lg' radius='md' withBorder h='100%'>
          <Stack spacing={0} mb='md'>
            <Title order={4}>
              Top 10 Prompt Tags
            </Title>
            <Text size='xs' color='dimmed'>
              Most commonly used tags
            </Text>
          </Stack>
          <Skeleton height={200} />
        </Card>
      </Grid.Col>
    );
  }

  if (!promptStats) {
    return null;
  }

  const aggregatedTags = promptStats.library.byTag
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <Grid.Col span={6}>
      <Card shadow='sm' padding='lg' radius='md' withBorder h='100%'>
        <Stack spacing={0} mb='md'>
          <Title order={4}>
            Top 10 Prompt Tags
          </Title>
          <Text size='xs' color='dimmed'>
            Most commonly used tags
          </Text>
        </Stack>
        <Group position='center' align='center' h='calc(100% - 60px)'>
          <RingProgress
            size={220}
            thickness={24}
            sections={aggregatedTags.map((tag, index) => {
              const totalTagCount = aggregatedTags.reduce((sum, t) => sum + t.count, 0);
              return {
                value: (tag.count / totalTagCount) * 100,
                color: getArtifactColor(index),
                tooltip: `${tag.tag}: ${tag.count} (${((tag.count / totalTagCount) * 100).toFixed(1)}%)`,
              };
            })}
            label={
              <Stack spacing={0} align='center'>
                <Text size='xl' weight={700}>
                  {aggregatedTags.reduce((sum, t) => sum + t.count, 0)}
                </Text>
                <Text size='xs' color='dimmed'>
                  Total
                </Text>
              </Stack>
            }
          />
          <Stack spacing='xs' ml='lg' style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {aggregatedTags.map((tag, index) => (
              <Group key={tag.tag} spacing='xs'>
                <Box
                  sx={(theme) => ({
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    backgroundColor: theme.colors[getArtifactColor(index)][6],
                  })}
                />
                <Text size='sm' weight={500}>
                  {tag.tag}
                </Text>
                <Text size='sm' color='dimmed'>
                  {tag.count}
                </Text>
              </Group>
            ))}
          </Stack>
        </Group>
      </Card>
    </Grid.Col>
  );
}
