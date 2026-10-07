import { Box, Card, Grid, Group, RingProgress, Skeleton, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { ArtifactStats } from '@/features/context-studio/types/context-studio';
import { getFileTypeConfig } from '@/features/chat/utils/chatHelperFunctions';

type ArtifactsByTypeSectionProps = Readonly<{
  artifactStats: ArtifactStats | undefined;
  artifactStatsLoading: boolean;
}>;

const getArtifactColor = (index: number) => {
  const colors = [
    'cyan', 'violet', 'orange', 'pink', 'teal', 'indigo', 'grape',
    'lime', 'yellow', 'blue', 'red', 'green', 'gray',
  ];
  return colors[index % colors.length];
};

const getArtifactTypeConfig = (fileType: string) => {
  return getFileTypeConfig(`.${fileType}`);
};

export default function ArtifactsByTypeSection({
  artifactStats,
  artifactStatsLoading,
}: ArtifactsByTypeSectionProps) {
  if (!artifactStatsLoading && (!artifactStats || artifactStats.byType.length === 0)) {
    return null;
  }

  return (
    <Grid.Col span={6}>
      <Card shadow='sm' padding='lg' radius='md' withBorder h='100%'>
        <Stack spacing={0} mb='md'>
          <Title order={4}>
            Artifacts by File Type
          </Title>
        </Stack>
        {artifactStatsLoading ? (
          <Group position='center' align='center' h='calc(100% - 60px)'>
            <Skeleton height={220} circle />
            <Stack spacing='xs' ml='lg'>
              <Skeleton height={20} width={120} />
              <Skeleton height={20} width={120} />
              <Skeleton height={20} width={120} />
            </Stack>
          </Group>
        ) : artifactStats ? (
          <Group position='center' align='center' h='calc(100% - 60px)'>
            <RingProgress
            size={220}
            thickness={24}
            sections={artifactStats.byType.map((artifact, index) => {
              return {
                value: (artifact.count / artifactStats.total) * 100,
                color: getArtifactColor(index),
                tooltip: `${artifact.type}: ${artifact.count} (${((artifact.count / artifactStats.total) * 100).toFixed(1)}%)`,
              };
            })}
            label={
              <Stack spacing={0} align='center'>
                <Text size='xl' weight={700}>
                  {artifactStats.total}
                </Text>
                <Text size='xs' color='dimmed'>
                  Total
                </Text>
              </Stack>
            }
          />
          <Stack spacing='xs' ml='lg' style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {artifactStats.byType.map((artifact, index) => {
              const config = getArtifactTypeConfig(artifact.type);
              const Icon = config.icon;
              return (
                <Group key={artifact.type} spacing='xs'>
                  <Box
                    sx={(theme) => ({
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      backgroundColor: theme.colors[getArtifactColor(index)][6],
                    })}
                  />
                  <ThemeIcon
                    size='sm'
                    c={config.color}
                    style={{ backgroundColor: 'transparent' }}
                  >
                    <Icon size={14} stroke={1.5} />
                  </ThemeIcon>
                  <Text size='sm' weight={500}>
                    {artifact.type}
                  </Text>
                  <Text size='sm' color='dimmed'>
                    {artifact.count}
                  </Text>
                </Group>
              );
            })}
          </Stack>
        </Group>
        ) : null}
      </Card>
    </Grid.Col>
  );
}
