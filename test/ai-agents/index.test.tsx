import { render, screen } from '@testing-library/react';
import AiAgentsPage from '@/pages/ai-agents';
import useGetAvailableAgents from '@/features/shared/api/get-available-agents';
import { AiAgentType } from '@/features/shared/types';

jest.mock('@/features/shared/api/get-available-agents', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/features/shared/api/get-available-agents');
jest.mock('@/features/ai-agents/components/AiAgents', () => {
  return jest.fn().mockReturnValue(<div>AI Agents Component</div>);
});

describe('AiAgentsPage', () => {
  const mockAgents = [
    {
      id: '2e6c2df8-7016-4a5a-8a5a-88f5d07e7b3f',
      label: 'Test Agent',
      description: 'Use the power of AI to ensure your website is compliant with all specified policies',
      type: AiAgentType.CERTA,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetAvailableAgents as jest.Mock).mockReturnValue({
      data: { availableAgents: mockAgents },
      isPending: false,
      error: null,
    });
  });

  it('renders page title', () => {
    render(<AiAgentsPage />);

    const title = screen.getByText('AI Agents');
    expect(title).toBeInTheDocument();
  });

  it('renders page description', () => {
    render(<AiAgentsPage />);

    const description = screen.getByText(
      'Purpose-built AI agents engineered for specialized tasks'
    );
    expect(description).toBeInTheDocument();
  });

  it('renders AI agents component', () => {
    render(<AiAgentsPage />);

    const aiAgents = screen.getByText('AI Agents Component');
    expect(aiAgents).toBeInTheDocument();
  });
});
