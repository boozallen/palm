import { fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AgentServiceRow from './AgentServiceRow';
import { notifications } from '@mantine/notifications';
import useTestAgentService from '@/features/settings/api/agent-services/test-agent-service';

jest.mock('@mantine/notifications', () => ({
  notifications: {
    show: jest.fn(),
  },
}));

jest.mock('@/features/settings/api/agent-services/test-agent-service');

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
      <table>
        <tbody>
          {children}
        </tbody>
      </table>
    </QueryClientProvider>
  );
}

describe('AgentServiceRow', () => {
  const mockService = {
    id: 'langgraph',
    name: 'Test Service',
    description: 'Test service description',
    endpoint: 'https://test-endpoint.com',
  };

  const mockMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useTestAgentService as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
  });

  it('renders service information correctly', () => {
    const { getAllByText, getByText } = render(
      <TestWrapper>
        <AgentServiceRow service={mockService} />
      </TestWrapper>
    );

    expect(getAllByText('Test Service')[0]).toBeInTheDocument();
    expect(getByText('Test service description')).toBeInTheDocument();
    expect(getByText('https://test-endpoint.com')).toBeInTheDocument();
  });

  it('renders dash when description is empty', () => {
    const serviceWithoutDescription = {
      ...mockService,
      description: '',
    };

    const { getByText } = render(
      <TestWrapper>
        <AgentServiceRow service={serviceWithoutDescription} />
      </TestWrapper>
    );
    expect(getByText('—')).toBeInTheDocument();
  });

  it('calls mutation when test service button is clicked', async () => {
    const { getAllByText } = render(
      <TestWrapper>
        <AgentServiceRow service={mockService} />
      </TestWrapper>
    );

    const testButton = getAllByText('Test Service')[1];
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        { serviceId: 'langgraph' },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        })
      );
    });
  });

  it('shows loading state on button when mutation is pending', () => {
    (useTestAgentService as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    });

    const { getAllByText } = render(
      <TestWrapper>
        <AgentServiceRow service={mockService} />
      </TestWrapper>
    );

    const button = getAllByText('Test Service')[1].closest('button');
    expect(button).toHaveAttribute('data-loading');
  });

  it('shows success notification on successful test', async () => {
    const { getAllByText } = render(
      <TestWrapper>
        <AgentServiceRow service={mockService} />
      </TestWrapper>
    );

    const testButton = getAllByText('Test Service')[1];
    fireEvent.click(testButton);

    const onSuccessCallback = mockMutate.mock.calls[0][1].onSuccess;
    onSuccessCallback({ isValid: true });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Service Test Successful',
        message: 'Test Service is configured correctly and responding.',
        icon: expect.anything(),
        color: 'green',
        autoClose: true,
      });
    });
  });

  it('shows failure notification on failed test', async () => {
    const { getAllByText } = render(
      <TestWrapper>
        <AgentServiceRow service={mockService} />
      </TestWrapper>
    );

    const testButton = getAllByText('Test Service')[1];
    fireEvent.click(testButton);

    const onSuccessCallback = mockMutate.mock.calls[0][1].onSuccess;
    onSuccessCallback({ isValid: false, errorMessage: 'Connection timeout' });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Service Test Failed',
        message: 'Connection timeout',
        icon: expect.anything(),
        color: 'red',
        autoClose: true,
      });
    });
  });

  it('shows error notification on mutation error', async () => {
    const { getAllByText } = render(
      <TestWrapper>
        <AgentServiceRow service={mockService} />
      </TestWrapper>
    );

    const testButton = getAllByText('Test Service')[1];
    fireEvent.click(testButton);

    const onErrorCallback = mockMutate.mock.calls[0][1].onError;
    onErrorCallback(new Error('Failed to test service'));

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Service Test Error',
        message: 'Failed to test service',
        icon: expect.anything(),
        color: 'red',
        autoClose: true,
      });
    });
  });
});
