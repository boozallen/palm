import { render, screen } from '@testing-library/react';
import AgentsPanel from './AgentsPanel';

// Sections are stubbed so these tests cover which sections the panel shows, not how each renders.
jest.mock('@/features/context-studio/components/sections/AgentProposalsSection', () => {
  return function AgentProposalsSection() {
    return <div data-testid='agent-proposals-section' />;
  };
});
jest.mock('@/features/context-studio/components/sections/AgentServiceSection', () => () => null);
jest.mock('@/features/context-studio/components/sections/AgentProviderSection', () => () => null);
jest.mock('@/features/context-studio/components/sections/AiAgentsSection', () => () => null);
jest.mock('@/features/context-studio/components/sections/AiProvidersSection', () => () => null);
jest.mock('@/features/context-studio/components/sections/MarginAnalysesCard', () => () => null);
jest.mock('@/features/context-studio/components/sections/OdramAssessmentSection', () => () => null);
jest.mock('@/features/context-studio/components/sections/OdramJobsCard', () => () => null);
jest.mock('@/features/context-studio/components/sections/PrismComplianceSection', () => () => null);
jest.mock('@/features/context-studio/components/sections/PrismJobsCard', () => () => null);
jest.mock('@/features/context-studio/components/sections/WorkflowSharingSection', () => () => null);

const BASE_PROPS = {
  promptStats: undefined,
  promptStatsLoading: false,
  workflowStats: undefined,
  workflowStatsLoading: false,
  aiAgentStats: undefined,
  aiAgentStatsLoading: false,
  agentServiceStats: undefined,
  agentServiceStatsLoading: false,
  agentProposalJobs: [],
  agentProposalJobsLoading: false,
  agentProposalJobsFailed: false,
};

describe('AgentsPanel', () => {
  it('shows the proposals section', () => {
    render(<AgentsPanel {...BASE_PROPS} />);

    expect(screen.getByTestId('agent-proposals-section')).toBeInTheDocument();
  });
});
