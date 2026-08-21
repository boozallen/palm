import { renderHook } from '@testing-library/react';
import { useGetActiveGraphBuilds } from './get-active-graph-builds';
import { trpc } from '@/libs';
import { GraphBuildStatus } from '@/features/graph-database/types';

jest.mock('@/libs', () => ({
  trpc: {
    graph: {
      getActiveGraphBuilds: {
        useQuery: jest.fn(),
      },
    },
  },
}));

describe('useGetActiveGraphBuilds', () => {
  const mockCreatedAt = new Date('2023-03-15T12:00:00Z');
  const mockQueryResponse = {
    data: [
      {
        graphId: 'graph-1',
        documentIds: ['doc-1', 'doc-2'],
        status: GraphBuildStatus.Building,
        progress: 75,
        currentStep: 'Processing embeddings',
        createdAt: mockCreatedAt,
        totalChunks: 100,
        processedChunks: 75,
      },
    ],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call trpc.graph.getActiveGraphBuilds.useQuery with correct parameters', () => {
    (trpc.graph.getActiveGraphBuilds.useQuery as jest.Mock).mockReturnValue(mockQueryResponse);

    renderHook(() => useGetActiveGraphBuilds());

    expect(trpc.graph.getActiveGraphBuilds.useQuery).toHaveBeenCalledWith(
      undefined,
      {
        refetchInterval: expect.any(Function),
      }
    );
  });

  it('should return the query response', () => {
    (trpc.graph.getActiveGraphBuilds.useQuery as jest.Mock).mockReturnValue(mockQueryResponse);

    const { result } = renderHook(() => useGetActiveGraphBuilds());

    expect(result.current).toEqual(mockQueryResponse);
  });

  it('should configure refetchInterval to poll when active builds exist', () => {
    (trpc.graph.getActiveGraphBuilds.useQuery as jest.Mock).mockReturnValue(mockQueryResponse);

    renderHook(() => useGetActiveGraphBuilds());

    const options = (trpc.graph.getActiveGraphBuilds.useQuery as jest.Mock).mock.calls[0][1];
    const refetchInterval = options.refetchInterval;

    // Mock query state with active builds
    const queryWithActiveBuilds = {
      state: {
        data: [
          { status: GraphBuildStatus.Building },
          { status: GraphBuildStatus.Pending },
        ],
      },
    };

    expect(refetchInterval(queryWithActiveBuilds)).toBe(3000);
  });

  it('should configure refetchInterval to not poll when no active builds exist', () => {
    (trpc.graph.getActiveGraphBuilds.useQuery as jest.Mock).mockReturnValue(mockQueryResponse);

    renderHook(() => useGetActiveGraphBuilds());

    const options = (trpc.graph.getActiveGraphBuilds.useQuery as jest.Mock).mock.calls[0][1];
    const refetchInterval = options.refetchInterval;

    // Mock query state with no active builds
    const queryWithNoActiveBuilds = {
      state: {
        data: [
          { status: GraphBuildStatus.Completed },
          { status: GraphBuildStatus.Failed },
        ],
      },
    };

    expect(refetchInterval(queryWithNoActiveBuilds)).toBe(false);
  });

  it('should configure refetchInterval to not poll when data is undefined', () => {
    (trpc.graph.getActiveGraphBuilds.useQuery as jest.Mock).mockReturnValue(mockQueryResponse);

    renderHook(() => useGetActiveGraphBuilds());

    const options = (trpc.graph.getActiveGraphBuilds.useQuery as jest.Mock).mock.calls[0][1];
    const refetchInterval = options.refetchInterval;

    // Mock query state with undefined data
    const queryWithUndefinedData = {
      state: {
        data: undefined,
      },
    };

    expect(refetchInterval(queryWithUndefinedData)).toBe(false);
  });

  it('should configure refetchInterval to poll when builds have resolving status', () => {
    (trpc.graph.getActiveGraphBuilds.useQuery as jest.Mock).mockReturnValue(mockQueryResponse);

    renderHook(() => useGetActiveGraphBuilds());

    const options = (trpc.graph.getActiveGraphBuilds.useQuery as jest.Mock).mock.calls[0][1];
    const refetchInterval = options.refetchInterval;

    // Mock query state with resolving builds
    const queryWithResolvingBuilds = {
      state: {
        data: [
          { status: GraphBuildStatus.Resolving },
        ],
      },
    };

    expect(refetchInterval(queryWithResolvingBuilds)).toBe(3000);
  });

  it('should configure refetchInterval to poll when a build is Cancelling', () => {
    (trpc.graph.getActiveGraphBuilds.useQuery as jest.Mock).mockReturnValue(mockQueryResponse);

    renderHook(() => useGetActiveGraphBuilds());

    const options = (trpc.graph.getActiveGraphBuilds.useQuery as jest.Mock).mock.calls[0][1];
    const refetchInterval = options.refetchInterval;

    const queryWithCancellingBuild = {
      state: {
        data: [
          { status: GraphBuildStatus.Cancelling },
        ],
      },
    };

    expect(refetchInterval(queryWithCancellingBuild)).toBe(3000);
  });

  it('should configure refetchInterval to not poll when all builds are inactive', () => {
    (trpc.graph.getActiveGraphBuilds.useQuery as jest.Mock).mockReturnValue(mockQueryResponse);

    renderHook(() => useGetActiveGraphBuilds());

    const options = (trpc.graph.getActiveGraphBuilds.useQuery as jest.Mock).mock.calls[0][1];
    const refetchInterval = options.refetchInterval;

    // Mock query state with only inactive builds
    const queryWithInactiveBuilds = {
      state: {
        data: [
          { status: GraphBuildStatus.Completed },
          { status: GraphBuildStatus.Failed },
        ],
      },
    };

    expect(refetchInterval(queryWithInactiveBuilds)).toBe(false);
  });

  it('should configure refetchInterval to not poll when data array is empty', () => {
    (trpc.graph.getActiveGraphBuilds.useQuery as jest.Mock).mockReturnValue(mockQueryResponse);

    renderHook(() => useGetActiveGraphBuilds());

    const options = (trpc.graph.getActiveGraphBuilds.useQuery as jest.Mock).mock.calls[0][1];
    const refetchInterval = options.refetchInterval;

    // Mock query state with empty data array
    const queryWithEmptyData = {
      state: {
        data: [],
      },
    };

    expect(refetchInterval(queryWithEmptyData)).toBe(false);
  });
});