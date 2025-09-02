import { render, screen } from '@testing-library/react';

import AiAgents from './AiAgents';
import { AiAgent, AiAgentType } from '@/features/shared/types';

jest.mock('@/features/ai-agents/components/AgentCard', () => {
  return jest.fn().mockReturnValue(<>AI Agent Card</>);
});

describe('AiAgents', () => {
  const mockAgents: AiAgent[] = [
    {
      id: '2e6c2df8-7016-4a5a-8a5a-88f5d07e7b3f',
      label: 'Test Agent',
      description: 'Use the power of AI to ensure your website is compliant with all specified policies',
      type: AiAgentType.CERTA,
    },
  ];

  it('renders correct number of agents when agents are provided', () => {
    render(<AiAgents agents={mockAgents} />);

    expect(
      screen.getAllByText('AI Agent Card')
    ).toHaveLength(1);
  });

  it('renders no agents message when no agents are provided', () => {
    render(<AiAgents agents={[]} />);

    expect(
      screen.getByText('No AI Agents have been configured yet.')
    ).toBeInTheDocument();
  });

  it('renders no agents message when agents prop is undefined', () => {
    render(<AiAgents />);

    expect(
      screen.getByText('No AI Agents have been configured yet.')
    ).toBeInTheDocument();
  });
});
