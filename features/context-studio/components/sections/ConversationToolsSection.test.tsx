import { render, screen } from '@testing-library/react';
import ConversationToolsSection from './ConversationToolsSection';
import { ConversationToolStats } from '@/features/context-studio/types/context-studio';

describe('ConversationToolsSection', () => {
  const mockConversationToolStats: ConversationToolStats = {
    totalToolCalls: 450,
    byAgentService: [
      {
        agentService: 'LangGraph',
        totalToolCalls: 300,
        toolCallsByType: [
          { toolName: 'search', count: 200 },
          { toolName: 'create_docx', count: 100 },
        ],
      },
      {
        agentService: 'Claude',
        totalToolCalls: 150,
        toolCallsByType: [
          { toolName: 'Read', count: 100 },
          { toolName: 'Bash', count: 50 },
        ],
      },
    ],
  };

  it('should not render when conversationToolStats is undefined', () => {
    render(
      <ConversationToolsSection
        conversationToolStats={undefined}
        conversationToolStatsLoading={false}
      />
    );
    expect(screen.queryByTestId('conversation-tools-section')).not.toBeInTheDocument();
  });

  it('should not render when totalToolCalls is 0', () => {
    render(
      <ConversationToolsSection
        conversationToolStats={{
          totalToolCalls: 0,
          byAgentService: [
            { agentService: 'LangGraph', totalToolCalls: 0, toolCallsByType: [] },
            { agentService: 'Claude', totalToolCalls: 0, toolCallsByType: [] },
          ],
        }}
        conversationToolStatsLoading={false}
      />
    );
    expect(screen.queryByTestId('conversation-tools-section')).not.toBeInTheDocument();
  });

  it('should render skeleton when conversationToolStatsLoading is true', () => {
    render(
      <ConversationToolsSection
        conversationToolStats={undefined}
        conversationToolStatsLoading={true}
      />
    );
    expect(screen.getByTestId('conversation-tools-section')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-service-tool-calls-card-langgraph')).not.toBeInTheDocument();
  });

  it('should render the LangGraph ring with the raw tool name as its label', () => {
    render(
      <ConversationToolsSection
        conversationToolStats={mockConversationToolStats}
        conversationToolStatsLoading={false}
      />
    );

    expect(screen.getByTestId('agent-service-tool-calls-card-langgraph')).toBeInTheDocument();
    expect(screen.getByTestId('agent-service-tool-calls-card-langgraph-agent-service-name')).toHaveTextContent('LangGraph');
    expect(screen.getByTestId('agent-service-tool-calls-card-langgraph-total')).toHaveTextContent('300');
    expect(screen.getByTestId('agent-service-tool-calls-card-langgraph-label-search')).toHaveTextContent('search');
    expect(screen.getByTestId('agent-service-tool-calls-card-langgraph-label-create_docx')).toHaveTextContent('create_docx');
  });

  it('should render the Claude ring with the raw tool name as its label', () => {
    render(
      <ConversationToolsSection
        conversationToolStats={mockConversationToolStats}
        conversationToolStatsLoading={false}
      />
    );

    expect(screen.getByTestId('agent-service-tool-calls-card-claude')).toBeInTheDocument();
    expect(screen.getByTestId('agent-service-tool-calls-card-claude-agent-service-name')).toHaveTextContent('Claude');
    expect(screen.getByTestId('agent-service-tool-calls-card-claude-total')).toHaveTextContent('150');
    expect(screen.getByTestId('agent-service-tool-calls-card-claude-label-Read')).toHaveTextContent('Read');
    expect(screen.getByTestId('agent-service-tool-calls-card-claude-label-Bash')).toHaveTextContent('Bash');
  });

  it('should not render the LangGraph card when its breakdown is empty', () => {
    render(
      <ConversationToolsSection
        conversationToolStats={{
          ...mockConversationToolStats,
          byAgentService: [
            { agentService: 'LangGraph', totalToolCalls: 0, toolCallsByType: [] },
            mockConversationToolStats.byAgentService[1],
          ],
        }}
        conversationToolStatsLoading={false}
      />
    );

    expect(screen.queryByTestId('agent-service-tool-calls-card-langgraph')).not.toBeInTheDocument();
    expect(screen.getByTestId('agent-service-tool-calls-card-claude')).toBeInTheDocument();
  });

  it('should not render the Claude card when its breakdown is empty', () => {
    render(
      <ConversationToolsSection
        conversationToolStats={{
          ...mockConversationToolStats,
          byAgentService: [
            mockConversationToolStats.byAgentService[0],
            { agentService: 'Claude', totalToolCalls: 0, toolCallsByType: [] },
          ],
        }}
        conversationToolStatsLoading={false}
      />
    );

    expect(screen.queryByTestId('agent-service-tool-calls-card-claude')).not.toBeInTheDocument();
    expect(screen.getByTestId('agent-service-tool-calls-card-langgraph')).toBeInTheDocument();
  });
});
