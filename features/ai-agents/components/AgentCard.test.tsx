import { fireEvent, render, screen } from '@testing-library/react';
import { useRouter } from 'next/router';

import AgentCard from './AgentCard';
import { generateAgentUrl } from '@/features/ai-agents/utils/agents';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

describe('AgentCard', () => {
  const name= 'Agent Name';
  const description = 'Agent Description';
  const push = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useRouter as jest.Mock).mockReturnValue({ push });
  });

  it('should render agent name and description', () => {
    render(<AgentCard name={name} description={description} />);
    expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
  });

  it('should navigate to agent page on click', () => {
    render(<AgentCard name={name} description={description} />);

    screen.getByText(name).click();

    expect(push).toHaveBeenCalledWith(
      generateAgentUrl(name),
    );
  });

  it('should navigate to agent page on enter key press', () => {
    render(<AgentCard name={name} description={description} />);
    const testId = `agent-card-${name}`;
    const card = screen.getByTestId(testId);

    card.focus();
    fireEvent.keyDown(card, { key: 'Enter' });

    expect(push).toHaveBeenCalledWith(
      generateAgentUrl(name),
    );
  });
});
