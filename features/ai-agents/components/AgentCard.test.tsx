import { fireEvent, render, screen } from '@testing-library/react';
import { useRouter } from 'next/router';

import AgentCard from './AgentCard';
import { generateAgentUrl } from '@/features/ai-agents/utils/agents';

jest.mock('@/features/ai-agents/utils/agents', () => ({
  generateAgentUrl: jest.fn(),
  generateAgentUrlOld: jest.fn(),
}));

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

describe('AgentCard', () => {
  const id='123456-abcdef-123456-abcdef';
  const label = 'Agent Name';
  const description = 'Agent Description';
  const push = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useRouter as jest.Mock).mockReturnValue({ push });
  });

  it('should render agent name and description', () => {
    render(<AgentCard id={id} label={label} description={description} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
  });

  it('should call generateAgentUrl', () => {
    render(<AgentCard id={id} label={label} description={description} />);

    expect(generateAgentUrl).toHaveBeenCalledWith(label, id);
  });

  it('should navigate to agent page on click', () => {
    render(<AgentCard id={id} label={label} description={description} />);

    screen.getByText(label).click();

    expect(push).toHaveBeenCalled();
  });

  it('should navigate to agent page on enter key press', () => {
    render(<AgentCard id={id} label={label} description={description} />);
    const testId = `agent-card-${label}`;
    const card = screen.getByTestId(testId);

    card.focus();
    fireEvent.keyDown(card, { key: 'Enter' });

    expect(push).toHaveBeenCalledWith(
      generateAgentUrl(label, id),
    );
  });
});
