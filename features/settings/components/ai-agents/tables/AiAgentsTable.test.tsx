import { render, screen } from '@testing-library/react';
import AiAgentsTable from '@/features/settings/components/ai-agents/tables/AiAgentsTable';
import useGetAiAgents from '@/features/settings/api/ai-agents/get-ai-agents';
import { AiAgentType } from '@/features/shared/types';

jest.mock('@/features/settings/api/ai-agents/get-ai-agents');

jest.mock('./AiAgentsRow', () => {
  return function MockedAiAgentsRow() {
    return <tr data-testid='ai-agents-row'></tr>;
  };
});

describe('AiAgentsTable', () => {
  let getAiAgentsMockReturn: any;

  const tableTestId = 'ai-agents-table';

  beforeEach(() => {
    jest.clearAllMocks();

    getAiAgentsMockReturn = {
      data: {
        aiAgents: [],
      },
      isPending: false,
      error: null,
    };
  });

  it('renders without crashing', () => {
    (useGetAiAgents as jest.Mock).mockReturnValue(getAiAgentsMockReturn);
    const { container } = render(<AiAgentsTable />);
    expect(container).toBeTruthy();
  });

  it('does not render table if aiAgents is an empty array', () => {
    (useGetAiAgents as jest.Mock).mockReturnValue(getAiAgentsMockReturn);
    const { queryByTestId, queryByText } = render(<AiAgentsTable />);

    expect(queryByTestId(tableTestId)).not.toBeInTheDocument();
    expect(queryByText('No AI Agents have been configured yet.')).toBeInTheDocument();
  });

  it('renders table if aiAgents is not an empty array', () => {
    getAiAgentsMockReturn.data.aiAgents = [
      {
        id: '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2a',
        name: 'AI Agent 1',
        description: 'Description of AI Agent 1',
        type: AiAgentType.CERTA,
      },
      {
        id: '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2b',
        name: 'AI Agent 2',
        description: 'Description of AI Agent 2',
        type: AiAgentType.RADAR,
      },
    ];

    (useGetAiAgents as jest.Mock).mockReturnValue(getAiAgentsMockReturn);
    const { queryByTestId } = render(<AiAgentsTable />);
    expect(queryByTestId(tableTestId)).toBeInTheDocument();
  });

  it('renders AiAgentsRow for each AI Agent', () => {
    getAiAgentsMockReturn.data.aiAgents = [
      {
        id: '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2a',
        name: 'AI Agent 1',
        description: 'Description of AI Agent 1',
        type: AiAgentType.CERTA,
      },
      {
        id: '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2b',
        name: 'AI Agent 2',
        description: 'Description of AI Agent 2',
        type: AiAgentType.RADAR,
      },
    ];

    (useGetAiAgents as jest.Mock).mockReturnValue(getAiAgentsMockReturn);
    const { queryAllByTestId } = render(<AiAgentsTable />);
    expect(queryAllByTestId('ai-agents-row')).toHaveLength(2);
    expect(queryAllByTestId('ai-agents-row')[0]).toBeInTheDocument();
    expect(queryAllByTestId('ai-agents-row')[1]).toBeInTheDocument();
  });

  it('renders loading component if pending', () => {
    getAiAgentsMockReturn.isPending = true;
    (useGetAiAgents as jest.Mock).mockReturnValue(getAiAgentsMockReturn);

    const { queryByTestId, queryByText } = render(<AiAgentsTable />);

    expect(queryByText('Loading...')).toBeInTheDocument();
    expect(queryByTestId(tableTestId)).not.toBeInTheDocument();
  });

  it('renders error message if there is an error', () => {
    getAiAgentsMockReturn.error = new Error('Error fetching AI Agents');
    (useGetAiAgents as jest.Mock).mockReturnValue(getAiAgentsMockReturn);

    const { queryByText, queryByTestId } = render(<AiAgentsTable />);

    expect(queryByText('Error fetching AI Agents')).toBeInTheDocument();
    expect(queryByTestId(tableTestId)).not.toBeInTheDocument();
  });

  it('renders actions header', () => {
    getAiAgentsMockReturn.data.aiAgents = [
      {
        id: '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2a',
        name: 'AI Agent 1',
        description: 'Description of AI Agent 1',
        type: AiAgentType.CERTA,
      },
      {
        id: '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2b',
        name: 'AI Agent 2',
        description: 'Description of AI Agent 2',
        type: AiAgentType.RADAR,
      },
    ];

    (useGetAiAgents as jest.Mock).mockReturnValue(getAiAgentsMockReturn);

    render(<AiAgentsTable />);

    const actionsHeader = screen.getByText('Actions');

    expect(actionsHeader).toBeInTheDocument();
  });
});
