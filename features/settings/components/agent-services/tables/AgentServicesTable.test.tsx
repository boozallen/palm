import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AgentServicesTable from './AgentServicesTable';
import useGetAgentServices from '@/features/settings/api/agent-services/get-agent-services';

jest.mock('@/features/settings/api/agent-services/get-agent-services');

jest.mock('./AgentServicesTableHead', () => {
  return function MockedAgentServicesTableHead() {
    return (
      <thead data-testid='agent-services-table-head'>
        <tr>
          <th>Name</th>
        </tr>
      </thead>
    );
  };
});

jest.mock('./AgentServicesTableBody', () => {
  return function MockedAgentServicesTableBody() {
    return (
      <tbody data-testid='agent-services-table-body'>
        <tr>
          <td>Mock Body</td>
        </tr>
      </tbody>
    );
  };
});

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('AgentServicesTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state', () => {
    (useGetAgentServices as jest.Mock).mockReturnValue({
      data: undefined,
      isPending: true,
      error: null,
    });

    const { getByText } = render(
      <TestWrapper>
        <AgentServicesTable />
      </TestWrapper>
    );

    expect(getByText('Loading...')).toBeInTheDocument();
  });

  it('renders error state', async () => {
    (useGetAgentServices as jest.Mock).mockReturnValue({
      data: undefined,
      isPending: false,
      error: new Error('Failed to fetch agent services'),
    });

    const { findByText } = render(
      <TestWrapper>
        <AgentServicesTable />
      </TestWrapper>
    );

    expect(await findByText('Failed to fetch agent services')).toBeInTheDocument();
  });

  it('renders empty state when no services', async () => {
    (useGetAgentServices as jest.Mock).mockReturnValue({
      data: { services: [] },
      isPending: false,
      error: null,
    });

    const { findByText } = render(
      <TestWrapper>
        <AgentServicesTable />
      </TestWrapper>
    );

    expect(await findByText('No Agent Services have been configured yet.')).toBeInTheDocument();
  });

  it('renders table with services', async () => {
    (useGetAgentServices as jest.Mock).mockReturnValue({
      data: {
        services: [
          {
            id: '1',
            name: 'Test Service',
            description: 'Test Description',
            endpoint: 'https://test.com',
          },
        ],
      },
      isPending: false,
      error: null,
    });

    const { findByTestId } = render(
      <TestWrapper>
        <AgentServicesTable />
      </TestWrapper>
    );

    expect(await findByTestId('agent-services-table')).toBeInTheDocument();
    expect(await findByTestId('agent-services-table-head')).toBeInTheDocument();
    expect(await findByTestId('agent-services-table-body')).toBeInTheDocument();
  });
});
