import {
  recoverStalledJobs,
  registerStalledJobReconciler,
} from '@/features/graph-database/services/stalledJobRecovery';
import db from '@/server/db';
import { GraphBuildStatus } from '@/features/graph-database/types';
import { getRedisClient } from '@/server/storage/redisConnection';
import { QueueEvents } from 'bullmq';

jest.mock('@/server/db', () => ({
  graphBuildRun: {
    updateMany: jest.fn(),
    findFirst: jest.fn(),
  },
  graphMetadata: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/server/storage/redisConnection', () => ({
  getRedisClient: jest.fn(),
}));

jest.mock('bullmq', () => ({
  QueueEvents: jest.fn(),
}));

const mockUpdateMany = db.graphBuildRun.updateMany as jest.Mock;
const mockRunFindFirst = db.graphBuildRun.findFirst as jest.Mock;
const mockMetaFindMany = db.graphMetadata.findMany as jest.Mock;
const mockMetaUpdate = db.graphMetadata.update as jest.Mock;

describe('recoverStalledJobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockRunFindFirst.mockResolvedValue(null);
    mockMetaFindMany.mockResolvedValue([]);
    mockMetaUpdate.mockResolvedValue({});
  });

  it('marks stale running build runs as failed and returns the count', async () => {
    mockUpdateMany.mockResolvedValue({ count: 3 });

    const result = await recoverStalledJobs();

    expect(result.runsFailed).toBe(3);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { status: 'running', startedAt: { lt: expect.any(Date) } },
      data: expect.objectContaining({
        status: 'failed',
        completedAt: expect.any(Date),
        errorMessage: expect.stringContaining('auto-recovered'),
      }),
    });
  });

  it('reverts a previously-completed stuck graph to Completed and repairs stale progress', async () => {
    // Mirrors the 2026-06-04 incident: stale progress total (795) bled in from a
    // later multi-doc attempt; the real chunk count (76) lives in stats.
    mockMetaFindMany.mockResolvedValue([
      {
        graphId: 'g-completed',
        completedAt: new Date('2026-05-26T00:00:00Z'),
        buildProgress: { totalChunks: 795, processedChunks: 0, currentStep: 'Processing chunks' },
        stats: { extraction: { totalChunks: 76 } },
      },
    ]);

    const result = await recoverStalledJobs();

    expect(result.metadataReverted).toBe(1);
    expect(mockMetaUpdate).toHaveBeenCalledWith({
      where: { graphId: 'g-completed' },
      data: {
        status: GraphBuildStatus.Completed,
        buildProgress: expect.objectContaining({
          totalChunks: 76,
          processedChunks: 76,
          currentStep: 'Completed',
        }),
      },
    });
  });

  it('reverts a never-completed stuck graph to Failed without a progress object', async () => {
    mockMetaFindMany.mockResolvedValue([
      {
        graphId: 'g-never-done',
        completedAt: null,
        buildProgress: { totalChunks: 50, processedChunks: 10, currentStep: 'Resolving entities' },
        stats: {},
      },
    ]);

    const result = await recoverStalledJobs();

    expect(result.metadataReverted).toBe(1);
    expect(mockMetaUpdate).toHaveBeenCalledWith({
      where: { graphId: 'g-never-done' },
      data: { status: GraphBuildStatus.Failed },
    });
  });

  it('leaves a graph with a fresh running job untouched', async () => {
    mockMetaFindMany.mockResolvedValue([
      { graphId: 'g-fresh', completedAt: new Date(), buildProgress: {}, stats: {} },
    ]);
    mockRunFindFirst.mockResolvedValue({ id: 'fresh-run' });

    const result = await recoverStalledJobs();

    expect(result.metadataReverted).toBe(0);
    expect(mockMetaUpdate).not.toHaveBeenCalled();
  });

  it('sweeps all active statuses (Building, Resolving, Pending, Cancelling)', async () => {
    await recoverStalledJobs();

    expect(mockMetaFindMany).toHaveBeenCalledWith({
      where: {
        status: {
          in: [
            GraphBuildStatus.Building,
            GraphBuildStatus.Resolving,
            GraphBuildStatus.Pending,
            GraphBuildStatus.Cancelling,
          ],
        },
      },
      select: { graphId: true, completedAt: true, buildProgress: true, stats: true },
    });
  });

  it('reverts a graph stranded in Cancelling by a worker crash mid-rollback to Completed', async () => {
    mockMetaFindMany.mockResolvedValue([
      {
        graphId: 'g-stuck-cancelling',
        completedAt: new Date('2026-05-01T00:00:00Z'),
        buildProgress: {},
        stats: {},
      },
    ]);

    const result = await recoverStalledJobs();

    expect(result.metadataReverted).toBe(1);
    expect(mockMetaUpdate).toHaveBeenCalledWith({
      where: { graphId: 'g-stuck-cancelling' },
      data: expect.objectContaining({ status: GraphBuildStatus.Completed }),
    });
  });

  it('is idempotent — a second sweep with nothing stuck makes no changes', async () => {
    const result = await recoverStalledJobs();

    expect(result).toEqual({ runsFailed: 0, metadataReverted: 0 });
    expect(mockMetaUpdate).not.toHaveBeenCalled();
  });

  it('continues after a per-row revert failure (non-fatal)', async () => {
    mockMetaFindMany.mockResolvedValue([
      { graphId: 'g-bad', completedAt: new Date(), buildProgress: {}, stats: {} },
      { graphId: 'g-good', completedAt: new Date(), buildProgress: {}, stats: {} },
    ]);
    mockMetaUpdate.mockRejectedValueOnce(new Error('db hiccup')).mockResolvedValue({});

    const result = await recoverStalledJobs();

    // The failing row is skipped, the good one still reverts
    expect(result.metadataReverted).toBe(1);
    expect(mockMetaUpdate).toHaveBeenCalledTimes(2);
  });

  it('does not touch Neo4j (Postgres-status-only recovery)', async () => {
    mockMetaFindMany.mockResolvedValue([
      { graphId: 'g-completed', completedAt: new Date(), buildProgress: {}, stats: {} },
    ]);

    await recoverStalledJobs();

    // Only graph_metadata.update / graph_build_runs.updateMany are used; this
    // module imports no graph database source at all, so the partial Neo4j graph
    // is inherently preserved.
    expect(mockMetaUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('registerStalledJobReconciler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getRedisClient as jest.Mock).mockReturnValue({});
    (QueueEvents as unknown as jest.Mock).mockImplementation(() => ({ on: jest.fn() }));
  });

  it('registers failed/stalled listeners once and is idempotent across calls', async () => {
    const handlers: Record<string, (arg: { jobId: string }) => void> = {};
    const on = jest.fn((event: string, cb: (arg: { jobId: string }) => void) => {
      handlers[event] = cb;
    });
    (QueueEvents as unknown as jest.Mock).mockImplementation(() => ({ on }));

    registerStalledJobReconciler('graph-build-jobs');
    registerStalledJobReconciler('graph-build-jobs'); // second call must no-op

    expect(QueueEvents).toHaveBeenCalledTimes(1);
    expect(QueueEvents).toHaveBeenCalledWith('graph-build-jobs', { connection: {} });
    expect(on).toHaveBeenCalledWith('failed', expect.any(Function));
    expect(on).toHaveBeenCalledWith('stalled', expect.any(Function));
  });
});
