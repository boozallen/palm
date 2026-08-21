import { ContextType } from '@/server/trpc-context';
import { GraphBuildStatus } from '@/features/graph-database/types';
import graphRouter from '@/features/graph-database/routes';
import getActiveGraphBuilds from '@/features/graph-database/dal/getActiveGraphBuilds';

jest.mock('@/features/graph-database/dal/getActiveGraphBuilds');

describe('get-active-graph-builds route', () => {
  const mockUserId = 'test-user-id';

  const mockCtx = {
    userId: mockUserId,
    logger: {
      debug: jest.fn(),
    },
  } as unknown as ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return active graph builds successfully', async () => {
    const mockCreatedAt = new Date('2023-03-15T12:00:00Z');
    const mockActiveBuilds = [
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
      {
        graphId: 'graph-2',
        documentIds: ['doc-3'],
        status: GraphBuildStatus.Pending,
        progress: undefined,
        currentStep: undefined,
        createdAt: mockCreatedAt,
        totalChunks: undefined,
        processedChunks: undefined,
      },
    ];

    (getActiveGraphBuilds as jest.Mock).mockResolvedValue(mockActiveBuilds);

    const caller = graphRouter.createCaller(mockCtx);
    const response = await caller.getActiveGraphBuilds();

    expect(response).toEqual([
      {
        graphId: 'graph-1',
        documentIds: ['doc-1', 'doc-2'],
        status: GraphBuildStatus.Building,
        progress: 75,
        currentStep: 'Processing embeddings',
        createdAt: mockCreatedAt.toISOString(),
        totalChunks: 100,
        processedChunks: 75,
      },
      {
        graphId: 'graph-2',
        documentIds: ['doc-3'],
        status: GraphBuildStatus.Pending,
        progress: undefined,
        currentStep: undefined,
        createdAt: mockCreatedAt.toISOString(),
        totalChunks: undefined,
        processedChunks: undefined,
      },
    ]);
    expect(getActiveGraphBuilds).toHaveBeenCalledWith(mockUserId);
    expect(mockCtx.logger.debug).toHaveBeenCalledWith(
      `[ACTIVE-GRAPH-BUILDS] Found ${mockActiveBuilds.length} active builds for user ${mockUserId}`
    );
  });

  it('should return empty array when no active builds exist', async () => {
    const mockActiveBuilds: any[] = [];

    (getActiveGraphBuilds as jest.Mock).mockResolvedValue(mockActiveBuilds);

    const caller = graphRouter.createCaller(mockCtx);
    const response = await caller.getActiveGraphBuilds();

    expect(response).toEqual([]);
    expect(getActiveGraphBuilds).toHaveBeenCalledWith(mockUserId);
    expect(mockCtx.logger.debug).toHaveBeenCalledWith(
      `[ACTIVE-GRAPH-BUILDS] Found 0 active builds for user ${mockUserId}`
    );
  });

  it('should handle builds with all statuses in active states', async () => {
    const mockCreatedAt = new Date('2023-03-15T12:00:00Z');
    const mockActiveBuilds = [
      {
        graphId: 'graph-1',
        documentIds: ['doc-1'],
        status: GraphBuildStatus.Pending,
        progress: undefined,
        currentStep: undefined,
        createdAt: mockCreatedAt,
        totalChunks: undefined,
        processedChunks: undefined,
      },
      {
        graphId: 'graph-2',
        documentIds: ['doc-2'],
        status: GraphBuildStatus.Building,
        progress: 50,
        currentStep: 'Building graph',
        createdAt: mockCreatedAt,
        totalChunks: 100,
        processedChunks: 50,
      },
      {
        graphId: 'graph-3',
        documentIds: ['doc-3'],
        status: GraphBuildStatus.Resolving,
        progress: 90,
        currentStep: 'Resolving entities',
        createdAt: mockCreatedAt,
        totalChunks: 100,
        processedChunks: 90,
      },
    ];

    (getActiveGraphBuilds as jest.Mock).mockResolvedValue(mockActiveBuilds);

    const caller = graphRouter.createCaller(mockCtx);
    const response = await caller.getActiveGraphBuilds();

    expect(response).toEqual([
      {
        graphId: 'graph-1',
        documentIds: ['doc-1'],
        status: GraphBuildStatus.Pending,
        progress: undefined,
        currentStep: undefined,
        createdAt: mockCreatedAt.toISOString(),
        totalChunks: undefined,
        processedChunks: undefined,
      },
      {
        graphId: 'graph-2',
        documentIds: ['doc-2'],
        status: GraphBuildStatus.Building,
        progress: 50,
        currentStep: 'Building graph',
        createdAt: mockCreatedAt.toISOString(),
        totalChunks: 100,
        processedChunks: 50,
      },
      {
        graphId: 'graph-3',
        documentIds: ['doc-3'],
        status: GraphBuildStatus.Resolving,
        progress: 90,
        currentStep: 'Resolving entities',
        createdAt: mockCreatedAt.toISOString(),
        totalChunks: 100,
        processedChunks: 90,
      },
    ]);
    expect(getActiveGraphBuilds).toHaveBeenCalledWith(mockUserId);
  });

  it('should handle builds with optional fields', async () => {
    const mockCreatedAt = new Date('2023-03-15T12:00:00Z');
    const mockActiveBuilds = [
      {
        graphId: 'graph-1',
        documentIds: ['doc-1'],
        status: GraphBuildStatus.Building,
        createdAt: mockCreatedAt,
        // No progress, currentStep, totalChunks, or processedChunks
      },
    ];

    (getActiveGraphBuilds as jest.Mock).mockResolvedValue(mockActiveBuilds);

    const caller = graphRouter.createCaller(mockCtx);
    const response = await caller.getActiveGraphBuilds();

    expect(response).toEqual([
      {
        graphId: 'graph-1',
        documentIds: ['doc-1'],
        status: GraphBuildStatus.Building,
        createdAt: mockCreatedAt.toISOString(),
      },
    ]);
    expect(getActiveGraphBuilds).toHaveBeenCalledWith(mockUserId);
  });

  it('should propagate errors from getActiveGraphBuilds', async () => {
    const mockError = new Error('Failed to fetch active graph builds');
    (getActiveGraphBuilds as jest.Mock).mockRejectedValue(mockError);

    const caller = graphRouter.createCaller(mockCtx);

    await expect(caller.getActiveGraphBuilds()).rejects.toThrow('Failed to fetch active graph builds');

    expect(getActiveGraphBuilds).toHaveBeenCalledWith(mockUserId);
    expect(mockCtx.logger.debug).not.toHaveBeenCalled();
  });

  it('should validate output schema with required fields', async () => {
    const mockCreatedAt = new Date('2023-03-15T12:00:00Z');
    const mockActiveBuilds = [
      {
        graphId: 'graph-1',
        documentIds: ['doc-1', 'doc-2'],
        status: GraphBuildStatus.Building,
        progress: 75,
        currentStep: 'Processing',
        createdAt: mockCreatedAt,
        totalChunks: 100,
        processedChunks: 75,
      },
    ];

    (getActiveGraphBuilds as jest.Mock).mockResolvedValue(mockActiveBuilds);

    const caller = graphRouter.createCaller(mockCtx);
    const response = await caller.getActiveGraphBuilds();

    // Verify the structure matches the expected schema
    expect(Array.isArray(response)).toBe(true);
    response.forEach((build) => {
      expect(typeof build.graphId).toBe('string');
      expect(Array.isArray(build.documentIds)).toBe(true);
      expect(Object.values(GraphBuildStatus)).toContain(build.status);
      expect(typeof build.createdAt).toBe('string');
      expect(() => new Date(build.createdAt)).not.toThrow();
      if (build.progress !== undefined) {
        expect(typeof build.progress).toBe('number');
      }
      if (build.currentStep !== undefined) {
        expect(typeof build.currentStep).toBe('string');
      }
      if (build.totalChunks !== undefined) {
        expect(typeof build.totalChunks).toBe('number');
      }
      if (build.processedChunks !== undefined) {
        expect(typeof build.processedChunks).toBe('number');
      }
    });
  });

  it('should pass newDocumentIds through the output schema while keeping the full documentIds union', async () => {
    const mockCreatedAt = new Date('2023-03-15T12:00:00Z');
    const mockActiveBuilds = [
      {
        graphId: 'graph-1',
        documentIds: ['doc-1', 'doc-2', 'doc-3'],
        newDocumentIds: ['doc-3'],
        status: GraphBuildStatus.Building,
        progress: 10,
        currentStep: 'Extracting doc-3',
        createdAt: mockCreatedAt,
        totalChunks: 100,
        processedChunks: 10,
      },
    ];

    (getActiveGraphBuilds as jest.Mock).mockResolvedValue(mockActiveBuilds);

    const caller = graphRouter.createCaller(mockCtx);
    const response = await caller.getActiveGraphBuilds();

    expect(response[0].newDocumentIds).toEqual(['doc-3']);
    expect(response[0].documentIds).toEqual(['doc-1', 'doc-2', 'doc-3']);
  });

  it('should handle builds with multiple document IDs', async () => {
    const mockCreatedAt = new Date('2023-03-15T12:00:00Z');
    const mockActiveBuilds = [
      {
        graphId: 'graph-1',
        documentIds: ['doc-1', 'doc-2', 'doc-3', 'doc-4'],
        status: GraphBuildStatus.Building,
        progress: 25,
        currentStep: 'Processing multiple documents',
        createdAt: mockCreatedAt,
        totalChunks: 400,
        processedChunks: 100,
      },
    ];

    (getActiveGraphBuilds as jest.Mock).mockResolvedValue(mockActiveBuilds);

    const caller = graphRouter.createCaller(mockCtx);
    const response = await caller.getActiveGraphBuilds();

    expect(response[0].documentIds).toHaveLength(4);
    expect(response[0].documentIds).toEqual(['doc-1', 'doc-2', 'doc-3', 'doc-4']);
  });
});