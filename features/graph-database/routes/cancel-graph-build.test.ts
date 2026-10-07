import { TRPCError } from '@trpc/server';

import graphRouter from '@/features/graph-database/routes';
import db from '@/server/db';
import { GraphBuildStatus } from '@/features/graph-database/types';
import { getGraphBuildQueue } from '@/features/graph-database/utils/worker/queue';
import { requestGraphCancellation, clearGraphCancellation } from '@/features/graph-database/utils/graphCancellation';
import { rollbackCancelledBuild } from '@/features/graph-database/dal/rollbackCancelledBuild';
import { cancelRunningBuildRunsForGraph } from '@/features/graph-database/dal/graphBuildRuns';
import type { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    graphMetadata: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('@/features/graph-database/utils/worker/queue', () => ({
  getGraphBuildQueue: jest.fn(),
}));

jest.mock('@/features/graph-database/utils/graphCancellation', () => ({
  requestGraphCancellation: jest.fn(),
  clearGraphCancellation: jest.fn(),
}));

jest.mock('@/features/graph-database/dal/rollbackCancelledBuild', () => ({
  rollbackCancelledBuild: jest.fn(),
}));

jest.mock('@/features/graph-database/dal/graphBuildRuns', () => ({
  cancelRunningBuildRunsForGraph: jest.fn(),
}));

const mockDbGraphMetadata = db.graphMetadata as jest.Mocked<typeof db.graphMetadata>;
const mockGetGraphBuildQueue = getGraphBuildQueue as jest.Mock;
const mockRequestGraphCancellation = requestGraphCancellation as jest.Mock;
const mockClearGraphCancellation = clearGraphCancellation as jest.Mock;
const mockRollbackCancelledBuild = rollbackCancelledBuild as jest.Mock;
const mockCancelRunningBuildRunsForGraph = cancelRunningBuildRunsForGraph as jest.Mock;

function metadataRow(overrides: Partial<{ status: string; userId: string }> = {}) {
  return {
    id: 'id-1',
    graphId: 'graph-123',
    userId: 'user-123',
    status: GraphBuildStatus.Building as string,
    documentIds: ['doc-1'],
    createdAt: new Date(),
    completedAt: null,
    errorMessage: null,
    buildProgress: null,
    stats: null,
    ...overrides,
  };
}

describe('cancelGraphBuild', () => {
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestGraphCancellation.mockResolvedValue(undefined);
    mockClearGraphCancellation.mockResolvedValue(undefined);
    mockRollbackCancelledBuild.mockResolvedValue(undefined);
    mockCancelRunningBuildRunsForGraph.mockResolvedValue(undefined);
    (mockDbGraphMetadata.update as jest.Mock).mockResolvedValue({});
    (mockDbGraphMetadata.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    ctx = {
      userId: 'user-123',
      userRole: UserRole.User,
      logger,
    } as unknown as ContextType;
  });

  it('throws NOT_FOUND if graph does not exist', async () => {
    mockDbGraphMetadata.findUnique.mockResolvedValue(null);

    const caller = graphRouter.createCaller(ctx);

    await expect(caller.cancelGraphBuild({ graphId: 'nonexistent' })).rejects.toThrow(TRPCError);
  });

  it('throws FORBIDDEN if user does not own the graph', async () => {
    mockDbGraphMetadata.findUnique.mockResolvedValue(metadataRow({ userId: 'different-user' }));

    const caller = graphRouter.createCaller(ctx);

    await expect(caller.cancelGraphBuild({ graphId: 'graph-123' })).rejects.toThrow(TRPCError);
  });

  it('returns failure without touching state when already Cancelling', async () => {
    mockDbGraphMetadata.findUnique.mockResolvedValue(metadataRow({ status: GraphBuildStatus.Cancelling }));

    const caller = graphRouter.createCaller(ctx);
    const result = await caller.cancelGraphBuild({ graphId: 'graph-123' });

    expect(result).toEqual({ success: false, message: 'Cancellation already in progress', settled: false });
    expect(mockRequestGraphCancellation).not.toHaveBeenCalled();
    expect(mockDbGraphMetadata.update).not.toHaveBeenCalled();
  });

  it('returns failure for a non-cancellable status (Completed)', async () => {
    mockDbGraphMetadata.findUnique.mockResolvedValue(metadataRow({ status: GraphBuildStatus.Completed }));

    const caller = graphRouter.createCaller(ctx);
    const result = await caller.cancelGraphBuild({ graphId: 'graph-123' });

    expect(result.success).toBe(false);
    expect(result.message).toContain('cannot be cancelled');
    expect(result.settled).toBe(true);
  });

  it('active job (remove rejects): conditionally marks Cancelling, does not roll back', async () => {
    mockDbGraphMetadata.findUnique.mockResolvedValue(metadataRow());
    const activeJob = {
      data: { graphId: 'graph-123', extractDocumentIds: ['doc-x'] },
      remove: jest.fn().mockRejectedValue(new Error('locked')),
    };
    mockGetGraphBuildQueue.mockReturnValue({
      getJobs: jest.fn().mockResolvedValue([activeJob]),
    });

    const caller = graphRouter.createCaller(ctx);
    const result = await caller.cancelGraphBuild({ graphId: 'graph-123' });

    expect(mockRequestGraphCancellation).toHaveBeenCalledWith('graph-123');
    // Conditional transition: only rows still in a cancellable status may be
    // flipped, so a build that settles mid-race is never overwritten.
    expect(mockDbGraphMetadata.updateMany).toHaveBeenCalledWith({
      where: {
        graphId: 'graph-123',
        status: { in: [GraphBuildStatus.Pending, GraphBuildStatus.Building, GraphBuildStatus.Resolving] },
      },
      data: { status: GraphBuildStatus.Cancelling, errorMessage: null },
    });
    expect(mockRollbackCancelledBuild).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.message).toContain('Cancelling');
    expect(result.settled).toBe(false);
  });

  it('race: build settled to Completed between remove() failing and the transition → rolls back anyway', async () => {
    mockDbGraphMetadata.findUnique
      .mockResolvedValueOnce(metadataRow()) // top-of-route read: still Building
      .mockResolvedValueOnce(metadataRow({ status: GraphBuildStatus.Completed }) as never); // re-read after 0-count
    (mockDbGraphMetadata.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    const activeJob = {
      data: { graphId: 'graph-123', extractDocumentIds: ['doc-x'] },
      remove: jest.fn().mockRejectedValue(new Error('locked')),
    };
    mockGetGraphBuildQueue.mockReturnValue({
      getJobs: jest.fn().mockResolvedValue([activeJob]),
    });

    const caller = graphRouter.createCaller(ctx);
    const result = await caller.cancelGraphBuild({ graphId: 'graph-123' });

    // Same outcome as remove() succeeding on a just-finished job: full undo of
    // the run the user asked to stop — never a row stranded on Cancelling.
    expect(mockRollbackCancelledBuild).toHaveBeenCalledWith({
      graphId: 'graph-123',
      userId: 'user-123',
      extractDocumentIds: ['doc-x'],
    });
    expect(result).toEqual({ success: true, message: 'Build cancelled.', settled: true });
  });

  it('race: a concurrent cancel already marked Cancelling → defers to the worker, no rollback', async () => {
    mockDbGraphMetadata.findUnique
      .mockResolvedValueOnce(metadataRow())
      .mockResolvedValueOnce(metadataRow({ status: GraphBuildStatus.Cancelling }) as never);
    (mockDbGraphMetadata.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    const activeJob = {
      data: { graphId: 'graph-123', extractDocumentIds: ['doc-x'] },
      remove: jest.fn().mockRejectedValue(new Error('locked')),
    };
    mockGetGraphBuildQueue.mockReturnValue({
      getJobs: jest.fn().mockResolvedValue([activeJob]),
    });

    const caller = graphRouter.createCaller(ctx);
    const result = await caller.cancelGraphBuild({ graphId: 'graph-123' });

    expect(mockRollbackCancelledBuild).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, message: 'Cancellation already in progress', settled: false });
  });

  it('queued job (remove resolves): rolls back immediately with the removed job extractDocumentIds', async () => {
    mockDbGraphMetadata.findUnique.mockResolvedValue(metadataRow({ status: GraphBuildStatus.Pending }));
    const queuedJob = {
      data: { graphId: 'graph-123', extractDocumentIds: ['doc-a', 'doc-b'] },
      remove: jest.fn().mockResolvedValue(undefined),
    };
    mockGetGraphBuildQueue.mockReturnValue({
      getJobs: jest.fn().mockResolvedValue([queuedJob]),
    });

    const caller = graphRouter.createCaller(ctx);
    const result = await caller.cancelGraphBuild({ graphId: 'graph-123' });

    expect(mockRollbackCancelledBuild).toHaveBeenCalledWith({
      graphId: 'graph-123',
      userId: 'user-123',
      extractDocumentIds: expect.arrayContaining(['doc-a', 'doc-b']),
    });
    expect(mockCancelRunningBuildRunsForGraph).toHaveBeenCalledWith('graph-123');
    expect(mockClearGraphCancellation).toHaveBeenCalledWith('graph-123');
    expect(result).toEqual({ success: true, message: 'Build cancelled.', settled: true });
  });

  it('no jobs found at all: rolls back immediately (no stuck Cancelling)', async () => {
    mockDbGraphMetadata.findUnique.mockResolvedValue(metadataRow());
    mockGetGraphBuildQueue.mockReturnValue({
      getJobs: jest.fn().mockResolvedValue([]),
    });

    const caller = graphRouter.createCaller(ctx);
    const result = await caller.cancelGraphBuild({ graphId: 'graph-123' });

    expect(mockRollbackCancelledBuild).toHaveBeenCalledWith({
      graphId: 'graph-123',
      userId: 'user-123',
      extractDocumentIds: [],
    });
    expect(mockDbGraphMetadata.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: GraphBuildStatus.Cancelling }) })
    );
    expect(result.success).toBe(true);
    expect(result.settled).toBe(true);
  });
});
