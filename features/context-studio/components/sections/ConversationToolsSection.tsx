import { Box, Card, Divider, Group, RingProgress, Skeleton, Stack, Text, Title } from '@mantine/core';
import { ConversationToolStats } from '@/features/context-studio/types/context-studio';

type ConversationToolsSectionProps = Readonly<{
  conversationToolStats: ConversationToolStats | undefined;
  conversationToolStatsLoading: boolean;
}>;

// Matches Settings > Agents & Services > Agent Services — the Claude ring gets
// the wider layout since its tool set (Read/Bash/Grep/Edit, fired by the nested
// subagent) tends to run deeper than the LangGraph agent's direct calls.
const AGENT_SERVICE_LAYOUT: Record<string, { color: string; flex: string; description: string }> = {
  LangGraph: {
    color: 'cyan',
    flex: '1 1 300px',
    description: 'Fired directly by the LangGraph agentic-chat graph',
  },
  Claude: {
    color: 'violet',
    flex: '0 1 50%',
    description: 'Fired by the nested Claude subagent, including skill repo commands run through a GitHub Provider',
  },
};

const getToolColor = (index: number) => {
  const colors = [
    'cyan', 'violet', 'orange', 'pink', 'teal', 'indigo', 'grape',
    'lime', 'yellow', 'blue', 'red', 'green', 'gray',
  ];
  return colors[index % colors.length];
};

type ToolBreakdown = { toolName: string; count: number }[];

// One donut + scrollable colored-swatch legend, reused per Agent Service.
// `colorOffset` keeps each service's donut from repeating the same hue
// sequence when more than one is visible on screen at once.
function ToolBreakdownRing({
  agentService,
  total,
  breakdown,
  colorOffset,
  flex,
}: Readonly<{
  agentService: string;
  total: number;
  breakdown: ToolBreakdown;
  colorOffset: number;
  flex: string;
}>) {
  const testId = `agent-service-tool-calls-card-${agentService.toLowerCase()}`;

  return (
    <Card
      shadow='xs'
      padding='lg'
      radius='md'
      withBorder
      sx={{ flex, minWidth: '300px' }}
      data-testid={testId}
    >
      <Stack spacing={0} mb='md'>
        <Title order={4} data-testid={`${testId}-agent-service-name`}>
          Agent Service: {agentService}
        </Title>
        <Text size='xs' color='dimmed'>
          {AGENT_SERVICE_LAYOUT[agentService]?.description ?? `Tools fired by the ${agentService} agent service`}
        </Text>
      </Stack>
      <Group position='center' align='center'>
        <RingProgress
          size={220}
          thickness={24}
          sections={breakdown.map((tool, index) => ({
            value: (tool.count / total) * 100,
            color: getToolColor(index + colorOffset),
            tooltip: `${tool.toolName}: ${tool.count} (${((tool.count / total) * 100).toFixed(1)}%)`,
          }))}
          label={
            <Stack spacing={0} align='center'>
              <Text size='xl' weight={700} data-testid={`${testId}-total`}>
                {total}
              </Text>
              <Text size='xs' color='dimmed'>
                Total
              </Text>
            </Stack>
          }
        />
        <Stack spacing='xs' ml='lg' style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {breakdown.map((tool, index) => (
            <Group key={tool.toolName} spacing='xs'>
              <Box
                sx={(theme) => ({
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  backgroundColor: theme.colors[getToolColor(index + colorOffset)][6],
                })}
              />
              <Text size='sm' weight={500} data-testid={`${testId}-label-${tool.toolName}`}>
                {tool.toolName}
              </Text>
              <Text size='sm' color='dimmed'>
                {tool.count}
              </Text>
            </Group>
          ))}
        </Stack>
      </Group>
    </Card>
  );
}

export default function ConversationToolsSection({
  conversationToolStats,
  conversationToolStatsLoading,
}: ConversationToolsSectionProps) {
  if (!conversationToolStatsLoading && (!conversationToolStats || conversationToolStats.totalToolCalls === 0)) {
    return null;
  }

  if (conversationToolStatsLoading) {
    return (
      <Card shadow='sm' padding='xl' radius='md' withBorder data-testid='conversation-tools-section'>
        <Stack spacing='lg'>
          <Box>
            <Title order={2} mb='xs'>
              Tools Fired
            </Title>
            <Text size='sm' color='dimmed'>
              Tool usage across conversations
            </Text>
          </Box>
          <Divider />
          <Skeleton height={300} />
        </Stack>
      </Card>
    );
  }

  if (!conversationToolStats) {
    return null;
  }

  return (
    <Card shadow='sm' padding='xl' radius='md' withBorder data-testid='conversation-tools-section'>
      <Stack spacing='lg'>
        <Box>
          <Title order={2} mb='xs'>
            Tools Fired
          </Title>
          <Text size='sm' color='dimmed'>
            Tool usage broken out by <Text span weight={700}>Agent Service</Text> (Settings &gt; Agents & Services).
            Skill repo commands, run through a <Text span weight={700}>GitHub Provider</Text> (Settings &gt; Providers),
            count toward the Claude service rather than their own category.
          </Text>
        </Box>

        <Divider />

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {conversationToolStats.byAgentService.map((service, index) => (
            service.toolCallsByType.length > 0 && (
              <ToolBreakdownRing
                key={service.agentService}
                agentService={service.agentService}
                total={service.totalToolCalls}
                breakdown={service.toolCallsByType}
                colorOffset={index * 3}
                flex={AGENT_SERVICE_LAYOUT[service.agentService]?.flex ?? '1 1 300px'}
              />
            )
          ))}
        </Box>
      </Stack>
    </Card>
  );
}
