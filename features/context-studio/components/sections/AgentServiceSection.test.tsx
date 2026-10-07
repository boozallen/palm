import { render, screen } from '@testing-library/react';
import { Grid } from '@mantine/core';
import AgentServiceSection from './AgentServiceSection';
import { AgentServiceStats } from '@/features/context-studio/types/context-studio';

describe('AgentServiceSection', () => {
  const mockAgentServiceStats: AgentServiceStats = {
    totalThreads: 150,
    threadsByStatus: [
      { status: 'completed', count: 120 },
      { status: 'failed', count: 20 },
      { status: 'running', count: 10 },
    ],
    threadsByGraphType: [
      { graphType: 'research', count: 80 },
      { graphType: 'analysis', count: 70 },
    ],
    chatsWithAgentProvider: 50,
    chatsByAgentProvider: [
      { provider: 'anthropic', count: 30 },
      { provider: 'openai', count: 20 },
    ],
    toolCallsByType: [
      { toolType: 'search', count: 200 },
      { toolType: 'calculator', count: 150 },
      { toolType: 'database', count: 100 },
    ],
    totalToolCalls: 450,
  };

  it('should not render when agentServiceStats is undefined', () => {
    const { container } = render(
      <Grid>
        <AgentServiceSection
          agentServiceStats={undefined}
          agentServiceStatsLoading={false}
        />
      </Grid>
    );
    expect(container.querySelector('.mantine-Grid-col')).toBeNull();
  });

  it('should not render when totalThreads is 0', () => {
    const emptyStats: AgentServiceStats = {
      ...mockAgentServiceStats,
      totalThreads: 0,
      chatsWithAgentProvider: 0,
    };
    const { container } = render(
      <Grid>
        <AgentServiceSection
          agentServiceStats={emptyStats}
          agentServiceStatsLoading={false}
        />
      </Grid>
    );
    expect(container.querySelector('.mantine-Grid-col')).toBeNull();
  });

  it('should render skeleton when agentServiceStatsLoading is true', () => {
    render(
      <Grid>
        <AgentServiceSection
          agentServiceStats={undefined}
          agentServiceStatsLoading={true}
        />
      </Grid>
    );
    expect(screen.getByTestId('agent-services-section')).toBeInTheDocument();
    expect(screen.queryByTestId('total-threads')).not.toBeInTheDocument();
  });

  it('should render Agent Services card with correct stats', () => {
    render(
      <Grid>
        <AgentServiceSection
          agentServiceStats={mockAgentServiceStats}
          agentServiceStatsLoading={false}
        />
      </Grid>
    );

    expect(screen.getByTestId('agent-services-card')).toBeInTheDocument();
    expect(screen.getByTestId('total-threads')).toHaveTextContent('150');
    expect(screen.getByTestId('total-tool-calls')).toHaveTextContent('450');
  });

  it('should render Tool Calls by Type card when toolCallsByType is not empty', () => {
    render(
      <Grid>
        <AgentServiceSection
          agentServiceStats={mockAgentServiceStats}
          agentServiceStatsLoading={false}
        />
      </Grid>
    );

    expect(screen.getByTestId('tool-calls-by-type-card')).toBeInTheDocument();
    expect(screen.getByTestId('tool-type-label-search')).toBeInTheDocument();
    expect(screen.getByTestId('tool-type-label-calculator')).toBeInTheDocument();
    expect(screen.getByTestId('tool-type-label-database')).toBeInTheDocument();
  });

  it('should render the raw tool name as its label', () => {
    render(
      <Grid>
        <AgentServiceSection
          agentServiceStats={{
            ...mockAgentServiceStats,
            toolCallsByType: [{ toolType: 'create_html', count: 5 }],
            totalToolCalls: 5,
          }}
          agentServiceStatsLoading={false}
        />
      </Grid>
    );

    expect(screen.getByTestId('tool-type-label-create_html')).toHaveTextContent('create_html');
  });

  it('should not render Tool Calls by Type card when toolCallsByType is empty', () => {
    const statsWithoutToolCalls: AgentServiceStats = {
      ...mockAgentServiceStats,
      toolCallsByType: [],
    };
    render(
      <Grid>
        <AgentServiceSection
          agentServiceStats={statsWithoutToolCalls}
          agentServiceStatsLoading={false}
        />
      </Grid>
    );

    expect(screen.queryByTestId('tool-calls-by-type-card')).not.toBeInTheDocument();
  });

  it('should render LangGraph Executions by Type card when threadsByGraphType is not empty', () => {
    render(
      <Grid>
        <AgentServiceSection
          agentServiceStats={mockAgentServiceStats}
          agentServiceStatsLoading={false}
        />
      </Grid>
    );

    expect(screen.getByTestId('langgraph-executions-by-type-card')).toBeInTheDocument();
    expect(screen.getByText('research')).toBeInTheDocument();
    expect(screen.getByText('analysis')).toBeInTheDocument();
  });

  it('should not render LangGraph Executions by Type card when threadsByGraphType is empty', () => {
    const statsWithoutGraphTypes: AgentServiceStats = {
      ...mockAgentServiceStats,
      threadsByGraphType: [],
    };
    render(
      <Grid>
        <AgentServiceSection
          agentServiceStats={statsWithoutGraphTypes}
          agentServiceStatsLoading={false}
        />
      </Grid>
    );

    expect(screen.queryByTestId('langgraph-executions-by-type-card')).not.toBeInTheDocument();
  });

  it('should render LangGraph Execution Status card when threadsByStatus is not empty', () => {
    render(
      <Grid>
        <AgentServiceSection
          agentServiceStats={mockAgentServiceStats}
          agentServiceStatsLoading={false}
        />
      </Grid>
    );

    expect(screen.getByTestId('langgraph-execution-status-card')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
  });

  it('should not render LangGraph Execution Status card when threadsByStatus is empty', () => {
    const statsWithoutStatus: AgentServiceStats = {
      ...mockAgentServiceStats,
      threadsByStatus: [],
    };
    render(
      <Grid>
        <AgentServiceSection
          agentServiceStats={statsWithoutStatus}
          agentServiceStatsLoading={false}
        />
      </Grid>
    );

    expect(screen.queryByTestId('langgraph-execution-status-card')).not.toBeInTheDocument();
  });

  it('should display formatted numbers with locale formatting', () => {
    const largeStats: AgentServiceStats = {
      ...mockAgentServiceStats,
      totalThreads: 1500000,
      totalToolCalls: 2500000,
      chatsWithAgentProvider: 500000,
    };
    render(
      <Grid>
        <AgentServiceSection
          agentServiceStats={largeStats}
          agentServiceStatsLoading={false}
        />
      </Grid>
    );

    expect(screen.getByTestId('total-threads')).toHaveTextContent('1,500,000');
    expect(screen.getByTestId('total-tool-calls')).toHaveTextContent('2,500,000');
  });

  it('should apply capitalize text transform to status labels', () => {
    render(
      <Grid>
        <AgentServiceSection
          agentServiceStats={mockAgentServiceStats}
          agentServiceStatsLoading={false}
        />
      </Grid>
    );

    const statusElement = screen.getByText('completed');
    expect(statusElement.className).toContain('mantine-Text-root');
  });
});
