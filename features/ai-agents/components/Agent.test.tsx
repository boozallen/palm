import { render, screen } from '@testing-library/react';

import Agent from './Agent';
import { AiAgentLabels, AiAgentType } from '@/features/shared/types';

jest.mock('./certa/Agent', () => {
  return jest.fn().mockReturnValue(
    <p>
      Compliance Evaluation, Reporting, and Tracking Agent (CERTA)
    </p>
  );
});

jest.mock('./radar/Agent', () => {
  return jest.fn().mockReturnValue(
    <p>
      Research Article Discovery and Reporting (RADAR)
    </p>
  );
});

describe('Agent', () => {
  const agentName = 'Test Agent';

  const defaultMessage = 'Agent not found, please try again later.';
  const mockAgentId = 'd59a6bfa-fe00-496e-9854-30c49f5d7588';

  beforeEach(jest.clearAllMocks);

  it('renders the CERTA agent when type matches', () => {
    render(<Agent name={agentName} id={mockAgentId} type={AiAgentType.CERTA} />);

    const agent = screen.getByText(AiAgentLabels[AiAgentType.CERTA]);
    expect(agent).toBeInTheDocument();
  });

  it('renders the RADAR agent when type matches', () => {
    render(<Agent name={agentName} id={mockAgentId} type={AiAgentType.RADAR} />);

    const agent = screen.getByText(AiAgentLabels[AiAgentType.RADAR]);
    expect(agent).toBeInTheDocument();
  });

  it('renders default message when agent is not found', () => {
    render(<Agent name={agentName} id={mockAgentId} type={0 as AiAgentType} />);

    const agent = screen.getByText(defaultMessage);
    expect(agent).toBeInTheDocument();
  });
});
