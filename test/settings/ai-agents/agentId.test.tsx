import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/router';

import AiAgentDetailsPage from '@/pages/settings/ai-agents/[id]';
import useGetAiAgent from '@/features/settings/api/ai-agents/get-ai-agent';
import { AiAgent } from '@/features/shared/types';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/features/settings/api/ai-agents/get-ai-agent');
jest.mock('@/features/settings/components/ai-agents/AgentPolicies', () => {
  return function MockAgentPolicies() {
    return <div>Mock Agent Policies</div>;
  };
});

const mockGetAiAgent = (agent?: AiAgent, isPending = false) => {
  (useGetAiAgent as jest.Mock).mockReturnValue({
    data: agent,
    isPending,
  });
};

const renderPage = () => render(<AiAgentDetailsPage />);

describe('AiAgentDetailsPage', () => {
  const push = jest.fn();
  const mockAgent: AiAgent = {
    id: '1234',
    name: 'Mock Agent',
    description: 'Mock Description',
    enabled: true,
  };

  beforeAll(() => {
    (useRouter as jest.Mock).mockReturnValue({
      query: { id: '1234' },
      push,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAiAgent(mockAgent);
  });
  it('renders page title', () => {
    renderPage();

    const title = screen.getByText(mockAgent.name);
    expect(title).toBeInTheDocument();
  });

  it('renders page description', () => {
    renderPage();

    const description = screen.getByText(mockAgent.description);
    expect(description).toBeInTheDocument();
  });

  it('renders tab', () => {
    renderPage();

    const tab = screen.getByText(/Configuration/);
    expect(tab).toBeInTheDocument();
  });

  it('renders agent details by default', () => {
    renderPage();

    const agentDetails = screen.getByText(/Mock Agent Policies/);
    expect(agentDetails).toBeInTheDocument();
  });

  it('renders nothing if agent is null', () => {
    mockGetAiAgent();
    const { container } = renderPage();

    expect(container).toBeEmptyDOMElement();
  });
});
