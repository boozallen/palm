import { render } from '@testing-library/react';
import AgentProvidersTable from './AgentProvidersTable';
import useGetAgentProviders from '@/features/settings/api/agent-providers/get-agent-providers';

jest.mock('@/features/settings/api/agent-providers/get-agent-providers');

jest.mock('./AgentProvidersTableBody', () => {
  return function MockedAgentProvidersTableBody() {
    return <tbody data-testid='agent-providers-table-body'></tbody>;
  };
});

describe('AgentProvidersTable', () => {
  let getAgentProvidersMockReturn: {
    data: { agentProviders: { id: string; name: string; description: string; endpoint: string }[] } | undefined;
    isPending: boolean;
    error: Error | null;
  };

  const tableTestId = 'agent-providers-table';

  beforeEach(() => {
    jest.clearAllMocks();

    getAgentProvidersMockReturn = {
      data: {
        agentProviders: [],
      },
      isPending: false,
      error: null,
    };
  });

  it('renders without crashing', () => {
    (useGetAgentProviders as jest.Mock).mockReturnValue(getAgentProvidersMockReturn);
    const { container } = render(<AgentProvidersTable />);
    expect(container).toBeTruthy();
  });

  it('shows empty state when there are no agent providers', () => {
    (useGetAgentProviders as jest.Mock).mockReturnValue(getAgentProvidersMockReturn);
    const { queryByTestId, queryByText } = render(<AgentProvidersTable />);

    expect(queryByTestId(tableTestId)).not.toBeInTheDocument();
    expect(queryByText('No Agent Providers have been configured yet.')).toBeInTheDocument();
  });

  it('renders the table when agent providers exist', () => {
    getAgentProvidersMockReturn.data = {
      agentProviders: [
        {
          id: '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09',
          name: 'Test Agent',
          description: 'A test agent',
          endpoint: 'https://agent.example.com',
        },
      ],
    };

    (useGetAgentProviders as jest.Mock).mockReturnValue(getAgentProvidersMockReturn);
    const { queryByTestId } = render(<AgentProvidersTable />);
    expect(queryByTestId(tableTestId)).toBeInTheDocument();
  });

  it('renders loading state when pending', () => {
    getAgentProvidersMockReturn.isPending = true;
    (useGetAgentProviders as jest.Mock).mockReturnValue(getAgentProvidersMockReturn);

    const { queryByText, queryByTestId } = render(<AgentProvidersTable />);

    expect(queryByText('Loading...')).toBeInTheDocument();
    expect(queryByTestId(tableTestId)).not.toBeInTheDocument();
  });

  it('renders error message when there is an error', () => {
    getAgentProvidersMockReturn.error = new Error('Error fetching agent providers');
    (useGetAgentProviders as jest.Mock).mockReturnValue(getAgentProvidersMockReturn);

    const { queryByText, queryByTestId } = render(<AgentProvidersTable />);

    expect(queryByText('Error fetching agent providers')).toBeInTheDocument();
    expect(queryByTestId(tableTestId)).not.toBeInTheDocument();
  });
});
