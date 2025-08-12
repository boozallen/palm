import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/router';

import { generateAgentSlug } from '@/features/ai-agents/utils/agents';
import AiAgentPage from '@/pages/ai-agents/[agentSlug]/[agentId]/index';
import useGetAvailableAgents from '@/features/shared/api/get-available-agents';
import { AiAgentType } from '@/features/shared/types';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/features/shared/api/get-available-agents');
jest.mock('@/features/ai-agents/components/Agent', () => {
  return jest.fn().mockReturnValue(<div>Agent Component</div>);
});

describe('agentSlugId', () => {
  const mockAgent = {
    id: '1',
    name: 'Test Agent',
    description: 'Use the power of AI to ensure your website is compliant with all specified policies',
    type: AiAgentType.CERTA,
  };
  const mockAgents = [mockAgent];

  const agentSlug = generateAgentSlug(mockAgent.name);
  const query = { agentSlug, agentId: mockAgent.id };
  const push = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useRouter as jest.Mock).mockReturnValue({ query, push });

    (useGetAvailableAgents as jest.Mock).mockReturnValue({
      data: { availableAgents: mockAgents },
      isPending: false,
      error: null,
    });
  });

  it('renders name and description', () => {
    render(<AiAgentPage />);

    const pageName = screen.getByTestId('agent-page-name');

    expect(pageName).toHaveTextContent(mockAgent.name);
    expect(pageName).toHaveTextContent(mockAgent.description);
  });

  it('renders breadcrumbs', () => {
    render(<AiAgentPage />);

    const breadcrumbs = screen.getAllByRole('link');

    expect(breadcrumbs).toHaveLength(2);
    expect(breadcrumbs[0]).toHaveTextContent('AI Agents');
    expect(breadcrumbs[1]).toHaveTextContent(mockAgent.name);
  });

  it('renders agent', () => {
    render(<AiAgentPage />);

    const agentComponent = screen.getByText('Agent Component');

    expect(agentComponent).toBeInTheDocument();
  });

  it('shows not found page if agent is not found', () => {
    (useRouter as jest.Mock).mockReturnValue({ query: { agentSlug: 'random-agent-title' }, push });

    render(<AiAgentPage />);

    expect('Agent not found').toBeInTheDocument;
  });
});
