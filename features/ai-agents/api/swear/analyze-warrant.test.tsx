import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import useAnalyzeWarrant, { useSwearStatus } from './analyze-warrant';
import { trpc } from '@/libs';

jest.mock('@/libs', () => ({
  trpc: {
    aiAgents: {
      analyzeWarrant: {
        useMutation: jest.fn(),
      },
      getSwearStatus: {
        useQuery: jest.fn(),
      },
    },
  },
}));

describe('useAnalyzeWarrant', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }
    return Wrapper;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return mutation from trpc', () => {
    const mockMutation = {
      mutateAsync: jest.fn(),
      isPending: false,
    };

    (trpc.aiAgents.analyzeWarrant.useMutation as jest.Mock).mockReturnValue(mockMutation);

    const { result } = renderHook(() => useAnalyzeWarrant(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(mockMutation);
  });
});

describe('useSwearStatus', () => {
  const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';
  const mockJobId = 'job-123';

  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }
    return Wrapper;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be disabled when jobId is null', () => {
    (trpc.aiAgents.getSwearStatus.useQuery as jest.Mock).mockReturnValue({
      data: null,
    });

    renderHook(() => useSwearStatus(mockAgentId, null), {
      wrapper: createWrapper(),
    });

    expect(trpc.aiAgents.getSwearStatus.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: mockAgentId }),
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  it('should be enabled when jobId is provided', () => {
    (trpc.aiAgents.getSwearStatus.useQuery as jest.Mock).mockReturnValue({
      data: null,
    });

    renderHook(() => useSwearStatus(mockAgentId, mockJobId), {
      wrapper: createWrapper(),
    });

    expect(trpc.aiAgents.getSwearStatus.useQuery).toHaveBeenCalledWith(
      { agentId: mockAgentId, jobId: mockJobId },
      expect.objectContaining({
        enabled: true,
      })
    );
  });

  it('should configure refetchInterval', () => {
    (trpc.aiAgents.getSwearStatus.useQuery as jest.Mock).mockReturnValue({
      data: null,
    });

    renderHook(() => useSwearStatus(mockAgentId, mockJobId), {
      wrapper: createWrapper(),
    });

    const callArgs = (trpc.aiAgents.getSwearStatus.useQuery as jest.Mock).mock.calls[0];
    const options = callArgs[1];

    expect(options.refetchInterval).toBeDefined();
    expect(typeof options.refetchInterval).toBe('function');
  });

  it('should stop polling when completed', () => {
    (trpc.aiAgents.getSwearStatus.useQuery as jest.Mock).mockReturnValue({
      data: { status: 'completed', results: {} },
    });

    renderHook(() => useSwearStatus(mockAgentId, mockJobId), {
      wrapper: createWrapper(),
    });

    const callArgs = (trpc.aiAgents.getSwearStatus.useQuery as jest.Mock).mock.calls[0];
    const options = callArgs[1];
    const refetchInterval = options.refetchInterval;

    const result = refetchInterval({ state: { data: { status: 'completed' } } });
    expect(result).toBe(false);
  });

  it('should stop polling when errored', () => {
    (trpc.aiAgents.getSwearStatus.useQuery as jest.Mock).mockReturnValue({
      data: { status: 'error', error: 'Something went wrong' },
    });

    renderHook(() => useSwearStatus(mockAgentId, mockJobId), {
      wrapper: createWrapper(),
    });

    const callArgs = (trpc.aiAgents.getSwearStatus.useQuery as jest.Mock).mock.calls[0];
    const options = callArgs[1];
    const refetchInterval = options.refetchInterval;

    const result = refetchInterval({ state: { data: { status: 'error' } } });
    expect(result).toBe(false);
  });

  it('should poll every 3 seconds when processing', () => {
    (trpc.aiAgents.getSwearStatus.useQuery as jest.Mock).mockReturnValue({
      data: { status: 'processing' },
    });

    renderHook(() => useSwearStatus(mockAgentId, mockJobId), {
      wrapper: createWrapper(),
    });

    const callArgs = (trpc.aiAgents.getSwearStatus.useQuery as jest.Mock).mock.calls[0];
    const options = callArgs[1];
    const refetchInterval = options.refetchInterval;

    const result = refetchInterval({ state: { data: { status: 'processing' } } });
    expect(result).toBe(3000);
  });
});
