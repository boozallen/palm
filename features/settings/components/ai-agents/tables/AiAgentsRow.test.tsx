import { render, screen } from '@testing-library/react';
import { notifications } from '@mantine/notifications';

import AiAgentsRow from './AiAgentsRow';
import useUpdateAiAgent from '@/features/settings/api/ai-agents/update-ai-agent';
import useGetCertaRequirements from '@/features/settings/api/ai-agents/certa/get-certa-requirements';
import useGetRadarRequirements from '@/features/settings/api/ai-agents/radar/get-radar-requirements';
import { AiAgentType } from '@/features/shared/types';

jest.mock('@/features/settings/api/ai-agents/update-ai-agent');
jest.mock('@/features/settings/api/ai-agents/certa/get-certa-requirements');
jest.mock('@/features/settings/api/ai-agents/radar/get-radar-requirements');
jest.mock('@/features/settings/components/ai-agents/elements/AgentActions', () => {
  return jest.fn(() => <div>Agent Actions</div>);
});

jest.mock('@mantine/notifications');

function TableRowWrapper(
  props: Readonly<{
    id: string;
    label: string;
    description: string;
    type: AiAgentType;
  }>
) {
  return (
    <table>
      <tbody>
        <AiAgentsRow {...props} />
      </tbody>
    </table>
  );
}

describe('AiAgentsRow', () => {
  const defaultProps = {
    id: '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2a',
    label: 'Test agent',
    description: 'This is a test AI agent description',
    type: AiAgentType.CERTA,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useUpdateAiAgent as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
      error: null,
    });

    (useGetCertaRequirements as jest.Mock).mockReturnValue({
      data: {
        configured: true,
        requirements: [],
      },
      isPending: false,
    });

    (useGetRadarRequirements as jest.Mock).mockReturnValue({
      data: {
        configured: true,
        requirements: [],
      },
      isPending: false,
    });

    (notifications.show as jest.Mock) = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the agent name correctly', () => {
    render(<TableRowWrapper {...defaultProps} />);
    expect(screen.getByText(defaultProps.label)).toBeInTheDocument();
  });

  it('displays an info icon with tooltip containing description', () => {
    render(<TableRowWrapper {...defaultProps} />);
    const infoIcon = screen.getByTestId('agent-management-info-icon');
    expect(infoIcon).toBeInTheDocument();
  });

  it('displays requirements when agent has unmet requirements', async () => {
    (useGetCertaRequirements as jest.Mock).mockReturnValue({
      data: {
        configured: false,
        requirements: [
          { name: 'Requirement 1', available: false },
          { name: 'Requirement 2', available: false },
        ],
      },
      isPending: false,
    });

    render(
      <TableRowWrapper
        {...{
          ...defaultProps,
        }}
      />
    );

    expect(screen.getByText('Requirement 1')).toBeInTheDocument();
    expect(screen.getByText('Requirement 2')).toBeInTheDocument();
  });

  it('renders AgentActions component', () => {
    render(<TableRowWrapper {...defaultProps} />);

    const agentActions = screen.getByText('Agent Actions');
    expect(agentActions).toBeInTheDocument();
  });
});
