import { Box, Card, Divider, Group, RingProgress, Skeleton, Stack, Text, Title } from '@mantine/core';
import { AgentServiceStats } from '@/features/context-studio/types/context-studio';

type AgentProviderSectionProps = Readonly<{
  agentServiceStats: AgentServiceStats | undefined;
  agentServiceStatsLoading: boolean;
}>;

const getProviderColor = (index: number) => {
  const colors = [
    'violet', 'pink', 'grape', 'indigo', 'cyan', 'teal', 'blue',
    'lime', 'yellow', 'orange', 'red', 'green', 'gray',
  ];
  return colors[index % colors.length];
};

export default function AgentProviderSection({
  agentServiceStats,
  agentServiceStatsLoading,
}: AgentProviderSectionProps) {
  if (!agentServiceStatsLoading && (!agentServiceStats || agentServiceStats.chatsWithAgentProvider === 0)) {
    return null;
  }

  if (agentServiceStatsLoading) {
    return (
      <Card shadow='sm' padding='xl' radius='md' withBorder data-testid='agent-providers-section'>
        <Stack spacing='lg'>
          <Box>
            <Title order={2} mb='xs'>
              Agent Providers
            </Title>
            <Text size='sm' color='dimmed'>
              Chat sessions and interactions with external agent providers
            </Text>
          </Box>
          <Divider />
          <Skeleton height={300} />
        </Stack>
      </Card>
    );
  }

  if (!agentServiceStats) {
    return null;
  }

  return (
    <Card shadow='sm' padding='xl' radius='md' withBorder data-testid='agent-providers-section'>
      <Stack spacing='lg'>
        <Box>
          <Title order={2} mb='xs'>
            Agent Providers
          </Title>
          <Text size='sm' color='dimmed'>
            Chat sessions and interactions with agent providers
          </Text>
        </Box>

        <Divider />

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <Card
            shadow='xs'
            padding='lg'
            radius='md'
            withBorder
            sx={{
              flex: '1 1 300px',
              minWidth: '300px',
            }}
            data-testid='agent-providers-card'
          >
            <Title order={4} mb='md'>
              Overview
            </Title>
            <Stack spacing='xs'>
              <Text size='sm' color='dimmed'>
                Agent Provider Chat Sessions
              </Text>
              <Text size='xl' weight={700} color='teal' data-testid='chats-with-agent-provider'>
                {agentServiceStats.chatsWithAgentProvider.toLocaleString()}
              </Text>
              <Text size='xs' color='dimmed' mt={-4}>
                Conversations with agent providers
              </Text>
            </Stack>
          </Card>

          {agentServiceStats.chatsByAgentProvider.length > 0 && (
            <Card
              shadow='xs'
              padding='lg'
              radius='md'
              withBorder
              sx={{
                flex: '1 1 300px',
                minWidth: '300px',
              }}
              data-testid='chat-sessions-by-agent-provider-card'
            >
              <Stack spacing={0} mb='md'>
                <Title order={4}>
                  Sessions by Agent Provider
                </Title>
                <Text size='xs' color='dimmed'>
                  Distribution of chat conversations across agent providers
                </Text>
              </Stack>
              <Group position='center' align='center'>
                <RingProgress
                  size={220}
                  thickness={24}
                  sections={agentServiceStats.chatsByAgentProvider.map((item, index) => {
                    return {
                      value: (item.count / agentServiceStats.chatsWithAgentProvider) * 100,
                      color: getProviderColor(index),
                      tooltip: `${item.provider}: ${item.count} (${((item.count / agentServiceStats.chatsWithAgentProvider) * 100).toFixed(1)}%)`,
                    };
                  })}
                  label={
                    <Stack spacing={0} align='center'>
                      <Text size='xl' weight={700}>
                        {agentServiceStats.chatsWithAgentProvider}
                      </Text>
                      <Text size='xs' color='dimmed'>
                        Total
                      </Text>
                    </Stack>
                  }
                />
                <Stack spacing='xs' ml='lg' style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {agentServiceStats.chatsByAgentProvider.map((item, index) => {
                    return (
                      <Group key={item.provider} spacing='xs'>
                        <Box
                          sx={(theme) => ({
                            width: 12,
                            height: 12,
                            borderRadius: 2,
                            backgroundColor: theme.colors[getProviderColor(index)][6],
                          })}
                        />
                        <Text size='sm' weight={500}>
                          {item.provider}
                        </Text>
                        <Text size='sm' color='dimmed'>
                          {item.count}
                        </Text>
                      </Group>
                    );
                  })}
                </Stack>
              </Group>
            </Card>
          )}
        </Box>
      </Stack>
    </Card>
  );
}
