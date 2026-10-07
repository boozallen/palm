import { Card, Grid, Group, Skeleton, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconFileText } from '@tabler/icons-react';
import { ArtifactStats } from '@/features/context-studio/types/context-studio';

type ArtifactsSectionProps = Readonly<{
  artifactStats: ArtifactStats | undefined;
  artifactStatsLoading: boolean;
}>;

export default function ArtifactsSection({
  artifactStats,
  artifactStatsLoading,
}: ArtifactsSectionProps) {
  if (!artifactStatsLoading && !artifactStats) {
    return null;
  }

  return (
    <Grid.Col span={6}>
      <Card shadow='sm' padding='md' radius='md' withBorder h='100%'>
        <Group spacing='xs' mb='md'>
          <ThemeIcon variant='light' c='blue' sx={{ pointerEvents: 'none' }}>
            <IconFileText size={20} />
          </ThemeIcon>
          <Title order={4}>
            Artifacts
          </Title>
        </Group>
        {artifactStatsLoading ? (
          <Stack spacing='md'>
            <Skeleton height={80} />
            <Skeleton height={80} />
            <Skeleton height={40} />
          </Stack>
        ) : artifactStats ? (
          <Stack spacing='md'>
            {/* Chat Artifacts */}
            <Stack spacing='xs'>
              <Text size='sm' weight={600} color='dimmed'>
                Chat
              </Text>
              <Stack spacing={4} ml={8}>
                <Group position='apart'>
                  <Text size='xs'>
                    Total
                  </Text>
                  <Text size='sm' weight={600}>
                    {artifactStats.chatArtifacts.total.toLocaleString()}
                  </Text>
                </Group>

                {/* LLM Model Only */}
                <Stack spacing={4} mt={8}>
                  <Group position='apart'>
                    <Text size='xs' weight={500} color='dimmed'>
                      LLM Model Only
                    </Text>
                    <Text size='xs' weight={500}>
                      {artifactStats.chatArtifacts.byCreationMethod.modelOnly.total.toLocaleString()}
                    </Text>
                  </Group>
                  {artifactStats.chatArtifacts.byCreationMethod.modelOnly.byModel.slice(0, 3).map((model) => (
                    <Group key={model.modelId} position='apart' ml={16}>
                      <Text size='xs' color='dimmed'>
                        {model.modelName}
                      </Text>
                      <Text size='xs' weight={500}>
                        {model.count.toLocaleString()}
                      </Text>
                    </Group>
                  ))}
                  {artifactStats.chatArtifacts.byCreationMethod.modelOnly.byModel.length > 3 && (
                    <Text size='xs' color='dimmed' ml={16}>
                      +{artifactStats.chatArtifacts.byCreationMethod.modelOnly.byModel.length - 3} more
                    </Text>
                  )}
                </Stack>

                {/* Agent Provider */}
                <Stack spacing={4} mt={8}>
                  <Group position='apart'>
                    <Text size='xs' weight={500} color='dimmed'>
                      Agent Provider
                    </Text>
                    <Text size='xs' weight={500}>
                      {artifactStats.chatArtifacts.byCreationMethod.agentProvider.total.toLocaleString()}
                    </Text>
                  </Group>
                  {artifactStats.chatArtifacts.byCreationMethod.agentProvider.byAgentProvider.slice(0, 3).map((provider) => (
                    <Group key={provider.agentProviderId} position='apart' ml={16}>
                      <Text size='xs' color='dimmed'>
                        {provider.agentProviderName}
                      </Text>
                      <Text size='xs' weight={500}>
                        {provider.count.toLocaleString()}
                      </Text>
                    </Group>
                  ))}
                  {artifactStats.chatArtifacts.byCreationMethod.agentProvider.byAgentProvider.length > 3 && (
                    <Text size='xs' color='dimmed' ml={16}>
                      +{artifactStats.chatArtifacts.byCreationMethod.agentProvider.byAgentProvider.length - 3} more
                    </Text>
                  )}
                </Stack>
              </Stack>
            </Stack>

            {/* Workflow Artifacts */}
            <Stack spacing='xs'>
              <Text size='sm' weight={600} color='dimmed'>
                Workflows
              </Text>
              <Stack spacing={4} ml={8}>
                <Group position='apart'>
                  <Text size='xs'>
                    Total
                  </Text>
                  <Text size='sm' weight={600}>
                    {artifactStats.workflow.toLocaleString()}
                  </Text>
                </Group>
              </Stack>
            </Stack>

            {/* Total Artifacts */}
            <Group position='apart' mt='xs' pt='xs' sx={(theme) => ({ borderTop: `1px solid ${theme.colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[3]}` })}>
              <Group spacing='xs'>
                <ThemeIcon size='sm' variant='light' color='cyan'>
                  <IconFileText size={16} />
                </ThemeIcon>
                <Text size='xs' weight={500}>
                  Total Artifacts
                </Text>
              </Group>
              <Text size='lg' weight={700} color='cyan'>
                {artifactStats.total.toLocaleString()}
              </Text>
            </Group>
          </Stack>
        ) : (
          <Text size='sm' color='dimmed'>
            No artifact data available
          </Text>
        )}
      </Card>
    </Grid.Col>
  );
}
