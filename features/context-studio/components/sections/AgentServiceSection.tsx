import { Box, Card, Divider, Group, RingProgress, Skeleton, Stack, Text, Title } from '@mantine/core';
import { AgentServiceStats } from '@/features/context-studio/types/context-studio';

type AgentServiceSectionProps = Readonly<{
  agentServiceStats: AgentServiceStats | undefined;
  agentServiceStatsLoading: boolean;
}>;

const getToolColor = (index: number) => {
  const colors = [
    'cyan', 'violet', 'orange', 'pink', 'teal', 'indigo', 'grape',
    'lime', 'yellow', 'blue', 'red', 'green', 'gray',
  ];
  return colors[index % colors.length];
};

export default function AgentServiceSection({
  agentServiceStats,
  agentServiceStatsLoading,
}: AgentServiceSectionProps) {
  if (!agentServiceStatsLoading && (!agentServiceStats || agentServiceStats.totalThreads === 0)) {
    return null;
  }

  if (agentServiceStatsLoading) {
    return (
      <Card shadow='sm' padding='xl' radius='md' withBorder data-testid='agent-services-section'>
        <Stack spacing='lg'>
          <Box>
            <Title order={2} mb='xs'>
              Agent Services
            </Title>
            <Text size='sm' color='dimmed'>
              LangGraph workflow executions and tool usage metrics
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
    <Card shadow='sm' padding='xl' radius='md' withBorder data-testid='agent-services-section'>
      <Stack spacing='lg'>
        <Box>
          <Title order={2} mb='xs'>
            Agent Services
          </Title>
          <Text size='sm' color='dimmed'>
            LangGraph workflow executions and tool usage metrics
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
            data-testid='agent-services-card'
          >
            <Title order={4} mb='md'>
              Overview
            </Title>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <Stack spacing='xs' sx={{ flex: '1 1 200px' }}>
                <Text size='sm' color='dimmed'>
                  LangGraph Executions
                </Text>
                <Text size='xl' weight={700} color='violet' data-testid='total-threads'>
                  {agentServiceStats.totalThreads.toLocaleString()}
                </Text>
                <Text size='xs' color='dimmed' mt={-4}>
                  Stateful workflow runs
                </Text>
              </Stack>
              <Stack spacing='xs' sx={{ flex: '1 1 200px' }}>
                <Text size='sm' color='dimmed'>
                  Total Tool Calls
                </Text>
                <Text size='xl' weight={700} color='cyan' data-testid='total-tool-calls'>
                  {agentServiceStats.totalToolCalls.toLocaleString()}
                </Text>
                <Text size='xs' color='dimmed' mt={-4}>
                  From LangGraph executions
                </Text>
              </Stack>
            </Box>
          </Card>

          {agentServiceStats.toolCallsByType.length > 0 && (
            <Card
              shadow='xs'
              padding='lg'
              radius='md'
              withBorder
              sx={{
                flex: '1 1 300px',
                minWidth: '300px',
              }}
              data-testid='tool-calls-by-type-card'
            >
              <Title order={4} mb='md'>
                Tool Calls by Type
              </Title>
              <Group position='center' align='center'>
                <RingProgress
                  size={220}
                  thickness={24}
                  sections={agentServiceStats.toolCallsByType.map((tool, index) => {
                    return {
                      value: (tool.count / agentServiceStats.totalToolCalls) * 100,
                      color: getToolColor(index),
                      tooltip: `${tool.toolType}: ${tool.count} (${((tool.count / agentServiceStats.totalToolCalls) * 100).toFixed(1)}%)`,
                    };
                  })}
                  label={
                    <Stack spacing={0} align='center'>
                      <Text size='xl' weight={700}>
                        {agentServiceStats.totalToolCalls}
                      </Text>
                      <Text size='xs' color='dimmed'>
                        Total
                      </Text>
                    </Stack>
                  }
                />
                <Stack spacing='xs' ml='lg' style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {agentServiceStats.toolCallsByType.map((tool, index) => {
                    return (
                      <Group key={tool.toolType} spacing='xs'>
                        <Box
                          sx={(theme) => ({
                            width: 12,
                            height: 12,
                            borderRadius: 2,
                            backgroundColor: theme.colors[getToolColor(index)][6],
                          })}
                        />
                        <Text size='sm' weight={500} data-testid={`tool-type-label-${tool.toolType}`}>
                          {tool.toolType}
                        </Text>
                        <Text size='sm' color='dimmed'>
                          {tool.count}
                        </Text>
                      </Group>
                    );
                  })}
                </Stack>
              </Group>
            </Card>
          )}

          {agentServiceStats.threadsByGraphType.length > 0 && (
            <Card
              shadow='xs'
              padding='lg'
              radius='md'
              withBorder
              sx={{
                flex: '1 1 300px',
                minWidth: '300px',
              }}
              data-testid='langgraph-executions-by-type-card'
            >
              <Stack spacing={0} mb='md'>
                <Title order={4}>
                  Executions by Type
                </Title>
                <Text size='xs' color='dimmed'>
                  Breakdown of workflow execution types
                </Text>
              </Stack>
              <Group position='center' align='center'>
                <RingProgress
                  size={220}
                  thickness={24}
                  sections={agentServiceStats.threadsByGraphType.map((item, index) => {
                    return {
                      value: (item.count / agentServiceStats.totalThreads) * 100,
                      color: getToolColor(index + 3),
                      tooltip: `${item.graphType}: ${item.count} (${((item.count / agentServiceStats.totalThreads) * 100).toFixed(1)}%)`,
                    };
                  })}
                  label={
                    <Stack spacing={0} align='center'>
                      <Text size='xl' weight={700}>
                        {agentServiceStats.totalThreads}
                      </Text>
                      <Text size='xs' color='dimmed'>
                        Total
                      </Text>
                    </Stack>
                  }
                />
                <Stack spacing='xs' ml='lg' style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {agentServiceStats.threadsByGraphType.map((item, index) => {
                    return (
                      <Group key={item.graphType} spacing='xs'>
                        <Box
                          sx={(theme) => ({
                            width: 12,
                            height: 12,
                            borderRadius: 2,
                            backgroundColor: theme.colors[getToolColor(index + 3)][6],
                          })}
                        />
                        <Text size='sm' weight={500}>
                          {item.graphType}
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

          {agentServiceStats.threadsByStatus.length > 0 && (
            <Card
              shadow='xs'
              padding='lg'
              radius='md'
              withBorder
              sx={{
                flex: '1 1 300px',
                minWidth: '300px',
              }}
              data-testid='langgraph-execution-status-card'
            >
              <Stack spacing={0} mb='md'>
                <Title order={4}>
                  Execution Status
                </Title>
                <Text size='xs' color='dimmed'>
                  Current state of workflow executions
                </Text>
              </Stack>
              <Group position='center' align='center'>
                <RingProgress
                  size={220}
                  thickness={24}
                  sections={agentServiceStats.threadsByStatus.map((item, index) => {
                    return {
                      value: (item.count / agentServiceStats.totalThreads) * 100,
                      color: getToolColor(index + 9),
                      tooltip: `${item.status}: ${item.count} (${((item.count / agentServiceStats.totalThreads) * 100).toFixed(1)}%)`,
                    };
                  })}
                  label={
                    <Stack spacing={0} align='center'>
                      <Text size='xl' weight={700}>
                        {agentServiceStats.totalThreads}
                      </Text>
                      <Text size='xs' color='dimmed'>
                        Total
                      </Text>
                    </Stack>
                  }
                />
                <Stack spacing='xs' ml='lg' style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {agentServiceStats.threadsByStatus.map((item, index) => {
                    return (
                      <Group key={item.status} spacing='xs'>
                        <Box
                          sx={(theme) => ({
                            width: 12,
                            height: 12,
                            borderRadius: 2,
                            backgroundColor: theme.colors[getToolColor(index + 9)][6],
                          })}
                        />
                        <Text size='sm' weight={500} tt='capitalize'>
                          {item.status}
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
