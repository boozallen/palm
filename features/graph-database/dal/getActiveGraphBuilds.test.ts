import { logger } from '@/server/logger';
import getActiveGraphBuilds from './getActiveGraphBuilds';
import db from '@/server/db';
import { GraphBuildStatus } from '@/features/graph-database/types';

jest.mock('@/server/db', () => ({
  graphMetadata: {
    findMany: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('getActiveGraphBuilds', () => {
  const mockUserId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return active graph builds with progress calculation', async () => {
    const mockCreatedAt = new Date('2023-03-15T12:00:00Z');
    const mockGraphMetadata = [
      {
        graphId: 'graph-1',
        documentIds: ['doc-1', 'doc-2'],
        status: GraphBuildStatus.Building,
        buildProgress: {
          totalChunks: 100,
          processedChunks: 75,
          currentStep: 'Processing embeddings',
        },
        createdAt: mockCreatedAt,
      },
      {
        graphId: 'graph-2',
        documentIds: ['doc-3'],
        status: GraphBuildStatus.Pending,
        buildProgress: null,
        createdAt: mockCreatedAt,
      },
    ];

    (db.graphMetadata.findMany as jest.Mock).mockResolvedValue(mockGraphMetadata);

    const result = await getActiveGraphBuilds(mockUserId);

    expect(result).toEqual([
      {
        graphId: 'graph-1',
        documentIds: ['doc-1', 'doc-2'],
        newDocumentIds: undefined,
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
        newDocumentIds: undefined,
        status: GraphBuildStatus.Pending,
        progress: undefined,
        currentStep: undefined,
        createdAt: mockCreatedAt,
        totalChunks: undefined,
        processedChunks: undefined,
      },
    ]);

    expect(db.graphMetadata.findMany).toHaveBeenCalledWith({
      where: {
        userId: mockUserId,
        status: {
          in: [GraphBuildStatus.Pending, GraphBuildStatus.Building, GraphBuildStatus.Resolving, GraphBuildStatus.Cancelling],
        },
      },
      select: {
        graphId: true,
        documentIds: true,
        status: true,
        buildProgress: true,
        createdAt: true,
      },
    });
  });

  it('should return newDocumentIds (processing subset) from buildProgress while documentIds stays the full union', async () => {
    const mockCreatedAt = new Date('2023-03-15T12:00:00Z');
    const mockGraphMetadata = [
      {
        graphId: 'graph-1',
        documentIds: ['doc-1', 'doc-2', 'doc-3'],
        status: GraphBuildStatus.Building,
        buildProgress: {
          newDocumentIds: ['doc-3'],
          totalChunks: 100,
          processedChunks: 10,
          currentStep: 'Extracting doc-3',
        },
        createdAt: mockCreatedAt,
      },
    ];

    (db.graphMetadata.findMany as jest.Mock).mockResolvedValue(mockGraphMetadata);

    const result = await getActiveGraphBuilds(mockUserId);

    expect(result[0].documentIds).toEqual(['doc-1', 'doc-2', 'doc-3']);
    expect(result[0].newDocumentIds).toEqual(['doc-3']);
  });

  it('should return undefined newDocumentIds when buildProgress lacks the field', async () => {
    const mockCreatedAt = new Date('2023-03-15T12:00:00Z');
    const mockGraphMetadata = [
      {
        graphId: 'graph-1',
        documentIds: ['doc-1', 'doc-2'],
        status: GraphBuildStatus.Building,
        buildProgress: {
          totalChunks: 100,
          processedChunks: 10,
          currentStep: 'Extracting',
        },
        createdAt: mockCreatedAt,
      },
    ];

    (db.graphMetadata.findMany as jest.Mock).mockResolvedValue(mockGraphMetadata);

    const result = await getActiveGraphBuilds(mockUserId);

    expect(result[0].newDocumentIds).toBeUndefined();
    expect(result[0].documentIds).toEqual(['doc-1', 'doc-2']);
  });

  it('should handle builds with zero total chunks', async () => {
    const mockCreatedAt = new Date('2023-03-15T12:00:00Z');
    const mockGraphMetadata = [
      {
        graphId: 'graph-1',
        documentIds: ['doc-1'],
        status: GraphBuildStatus.Building,
        buildProgress: {
          totalChunks: 0,
          processedChunks: 0,
          currentStep: 'Initializing',
        },
        createdAt: mockCreatedAt,
      },
    ];

    (db.graphMetadata.findMany as jest.Mock).mockResolvedValue(mockGraphMetadata);

    const result = await getActiveGraphBuilds(mockUserId);

    expect(result[0].progress).toBeUndefined();
    expect(result[0].currentStep).toBe('Initializing');
    expect(result[0].createdAt).toEqual(mockCreatedAt);
    expect(result[0].totalChunks).toBe(0);
    expect(result[0].processedChunks).toBe(0);
  });

  it('should handle builds with undefined processed chunks', async () => {
    const mockCreatedAt = new Date('2023-03-15T12:00:00Z');
    const mockGraphMetadata = [
      {
        graphId: 'graph-1',
        documentIds: ['doc-1'],
        status: GraphBuildStatus.Resolving,
        buildProgress: {
          totalChunks: 50,
          processedChunks: undefined,
          currentStep: 'Resolving entities',
        },
        createdAt: mockCreatedAt,
      },
    ];

    (db.graphMetadata.findMany as jest.Mock).mockResolvedValue(mockGraphMetadata);

    const result = await getActiveGraphBuilds(mockUserId);

    expect(result[0].progress).toBeUndefined();
    expect(result[0].currentStep).toBe('Resolving entities');
    expect(result[0].createdAt).toEqual(mockCreatedAt);
    expect(result[0].totalChunks).toBe(50);
    expect(result[0].processedChunks).toBeUndefined();
  });

  it('should return empty array when no active builds exist', async () => {
    (db.graphMetadata.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getActiveGraphBuilds(mockUserId);

    expect(result).toEqual([]);
    expect(db.graphMetadata.findMany).toHaveBeenCalledWith({
      where: {
        userId: mockUserId,
        status: {
          in: [GraphBuildStatus.Pending, GraphBuildStatus.Building, GraphBuildStatus.Resolving, GraphBuildStatus.Cancelling],
        },
      },
      select: {
        graphId: true,
        documentIds: true,
        status: true,
        buildProgress: true,
        createdAt: true,
      },
    });
  });

  it('should handle database errors and throw with custom message', async () => {
    const dbError = new Error('Database connection failed');
    (db.graphMetadata.findMany as jest.Mock).mockRejectedValue(dbError);

    await expect(getActiveGraphBuilds(mockUserId)).rejects.toThrow('Failed to fetch active graph builds');

    expect(logger.error).toHaveBeenCalledWith(
      `Error fetching active graph builds for user ${mockUserId}:`,
      dbError
    );
  });

  it('should round progress percentage correctly', async () => {
    const mockCreatedAt = new Date('2023-03-15T12:00:00Z');
    const mockGraphMetadata = [
      {
        graphId: 'graph-1',
        documentIds: ['doc-1'],
        status: GraphBuildStatus.Building,
        buildProgress: {
          totalChunks: 3,
          processedChunks: 1,
          currentStep: 'Processing',
        },
        createdAt: mockCreatedAt,
      },
    ];

    (db.graphMetadata.findMany as jest.Mock).mockResolvedValue(mockGraphMetadata);

    const result = await getActiveGraphBuilds(mockUserId);

    // 1/3 = 0.3333... which should round to 33
    expect(result[0].progress).toBe(33);
    expect(result[0].createdAt).toEqual(mockCreatedAt);
  });

  it('should handle builds with 100% completion', async () => {
    const mockCreatedAt = new Date('2023-03-15T12:00:00Z');
    const mockGraphMetadata = [
      {
        graphId: 'graph-1',
        documentIds: ['doc-1'],
        status: GraphBuildStatus.Building,
        buildProgress: {
          totalChunks: 50,
          processedChunks: 50,
          currentStep: 'Finalizing',
        },
        createdAt: mockCreatedAt,
      },
    ];

    (db.graphMetadata.findMany as jest.Mock).mockResolvedValue(mockGraphMetadata);

    const result = await getActiveGraphBuilds(mockUserId);

    expect(result[0].progress).toBe(100);
    expect(result[0].currentStep).toBe('Finalizing');
    expect(result[0].createdAt).toEqual(mockCreatedAt);
  });

  it('should query for all active statuses', async () => {
    (db.graphMetadata.findMany as jest.Mock).mockResolvedValue([]);

    await getActiveGraphBuilds(mockUserId);

    expect(db.graphMetadata.findMany).toHaveBeenCalledWith({
      where: {
        userId: mockUserId,
        status: {
          in: [GraphBuildStatus.Pending, GraphBuildStatus.Building, GraphBuildStatus.Resolving, GraphBuildStatus.Cancelling],
        },
      },
      select: {
        graphId: true,
        documentIds: true,
        status: true,
        buildProgress: true,
        createdAt: true,
      },
    });
  });
});
