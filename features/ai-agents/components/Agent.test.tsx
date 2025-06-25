import { render, screen } from '@testing-library/react';

import Agent from './Agent';
import { AgentType } from '@/features/shared/types';

jest.mock('./certa/Agent', () => {
  return jest.fn().mockReturnValue(
    <p>
      Compliance Evaluation, Reporting, and Tracking Agent (CERTA)
    </p>
  );
});

describe('Agent', () => {
  const certaName = AgentType.CERTA;
  const defaultMessage = 'Agent not found, please try again later.';
  const mockAgentId = 'd59a6bfa-fe00-496e-9854-30c49f5d7588';

  beforeEach(jest.clearAllMocks);

  it('renders the CERTA agent when name matches', () => {
    render(<Agent name={certaName} id={mockAgentId} />);

    const agent = screen.getByText(certaName);
    expect(agent).toBeInTheDocument();
  });

  it('renders default message when agent is not found', () => {
    render(<Agent name='Unknown Agent' id={mockAgentId} />);

    const agent = screen.getByText(defaultMessage);
    expect(agent).toBeInTheDocument();
  });
});
