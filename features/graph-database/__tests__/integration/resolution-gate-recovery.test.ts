/**
 * Integration test for the resolution gate + stalled-job recovery (Plan 1a).
 *
 * Headline invariant: a build left stuck in Resolving (no Completed row) but with
 * resolution-complete documents must route the NEXT build incrementally
 * (new x existing), never demote to a whole-corpus re-resolution. And
 * recoverStalledJobs must flip that stuck row to a terminal status while leaving
 * the Neo4j graph intact.
 *
 * The route and the recovery sweep are driven together against mocked DAL/Neo4j
 * boundaries so the gate decision and the cleanup are exercised as one flow.
 */

import graphRouter from '@/features/graph-database/routes';
import { getResolvedDocumentIds } from '@/features/graph-database/dal/getResolvedDocumentIds';
import { recoverStalledJobs } from '@/features/graph-database/services/stalledJobRecovery';
import verifyDocumentOwnership from '@/features/graph-database/dal/verifyDocumentOwnership';
import getGraphMetadata from '@/features/graph-database/dal/getGraphMetadata';
import createGraphMetadata from '@/features/graph-database/dal/createGraphMetadata';
import { isEntityResolutionEnabled } from '@/features/graph-database/utils/isEntityResolutionEnabled';
import db from '@/server/db';
import logger from '@/server/logger';
import { GraphBuildStatus } from '@/features/graph-database/types';
import { UserRole } from '@/features/shared/types/user';
import type { ContextType } from '@/server/trpc-context';

jest.mock('@/features/graph-database/dal/getResolvedDocumentIds');
jest.mock('@/features/graph-database/dal/verifyDocumentOwnership');
jest.mock('@/features/graph-database/dal/getGraphMetadata');
jest.mock('@/features/graph-database/dal/createGraphMetadata');
jest.mock('@/features/graph-database/utils/isEntityResolutionEnabled');
jest.mock('@/libs/featureFlags');
jest.mock('@/server/storage/redisConnection', () => ({ getRedisClient: jest.fn(() => ({})) }));
jest.mock('bullmq', () => ({ QueueEvents: jest.fn(() => ({ on: jest.fn() })) }));
jest.mock('@/server/db', () => ({
  graphMetadata: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  document: {
    findMany: jest.fn(),
  },
  graphBuildRun: {
    updateMany: jest.fn(),
    findFirst: jest.fn(),
  },
}));

const mockQueueAdd = jest.fn().mockResolvedValue(undefined);
jest.mock('@/features/graph-database/utils/worker/queue', () => ({
  getGraphBuildQueue: jest.fn(() => ({ add: mockQueueAdd })),
}));

const mockGetResolvedDocumentIds = getResolvedDocumentIds as jest.Mock;
const mockIsEntityResolutionEnabled = isEntityResolutionEnabled as jest.MockedFunction<
  typeof isEntityResolutionEnabled
>;
const mockVerifyOwnership = verifyDocumentOwnership as jest.Mock;
const mockGetGraphMetadata = getGraphMetadata as jest.Mock;
const mockCreateGraphMetadata = createGraphMetadata as jest.Mock;

const docA = '550e8400-e29b-41d4-a716-44665544000a';
const docB = '550e8400-e29b-41d4-a716-44665544000b';
const docC = '550e8400-e29b-41d4-a716-44665544000c';
const userId = '550e8400-e29b-41d4-a716-446655440000';

describe('Resolution gate + recovery (integration)', () => {
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsEntityResolutionEnabled.mockResolvedValue(true);

    mockVerifyOwnership.mockResolvedValue(true);
    mockGetGraphMetadata.mockResolvedValue(null);
    mockCreateGraphMetadata.mockResolvedValue({ graphId: 'graph-new' });
    (db.graphMetadata.update as jest.Mock).mockResolvedValue({});
    (db.document.findMany as jest.Mock).mockImplementation(async ({ where }) =>
      (where?.id?.in || []).map((id: string) => ({ id }))
    );
    (db.graphBuildRun.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (db.graphBuildRun.findFirst as jest.Mock).mockResolvedValue(null);
    (db.graphMetadata.findMany as jest.Mock).mockResolvedValue([]);

    ctx = {
      userId,
      userRole: UserRole.User,
      logger,
    } as unknown as ContextType;
  });

  it('routes a new doc incrementally (NOT whole-corpus) on top of a graph stuck in Resolving', async () => {
    // The graph died mid-resolution: stuck in Resolving, no Completed row.
    const stuckGraph = {
      graphId: 'g-stuck',
      status: GraphBuildStatus.Resolving,
      documentIds: [docA, docB],
      userId,
    };
    (db.graphMetadata.findFirst as jest.Mock).mockImplementation(async ({ where }) => {
      if (where?.status === GraphBuildStatus.Building) {
        return null; // no in-progress build blocking the request
      }
      return stuckGraph; // existing-graph lookup finds the stuck row
    });
    // docA/docB kept their resolutionComplete markers through the crash
    mockGetResolvedDocumentIds.mockResolvedValue([docA, docB]);

    const result = await graphRouter.createCaller(ctx).buildGraph({
      documentIds: [docA, docB, docC],
    });

    expect(result.isRebuilding).toBe(true);
    expect(result.graphId).toBe('g-stuck');

    // Incremental: only docC is new, resolved against the [docA, docB] base.
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'graph-build',
      expect.objectContaining({
        graphId: 'g-stuck',
        documentIds: [docC],
        isIncremental: true,
        existingDocumentIds: [docA, docB],
      })
    );
    // It must NOT abandon the stuck graph for a fresh whole-corpus build.
    expect(mockCreateGraphMetadata).not.toHaveBeenCalled();
  });

  it('recoverStalledJobs flips the stuck Resolving row appropriately and leaves Neo4j alone', async () => {
    // A previously-completed graph (completedAt set) whose re-graph died in
    // Resolving with a stale running run → revert to Completed, repair progress.
    (db.graphBuildRun.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (db.graphMetadata.findMany as jest.Mock).mockResolvedValue([
      {
        graphId: 'g-stuck',
        completedAt: new Date('2026-05-26T00:00:00Z'),
        buildProgress: { totalChunks: 0, processedChunks: 0, currentStep: 'Starting entity resolution...' },
        stats: { extraction: { totalChunks: 42 } },
      },
    ]);

    const result = await recoverStalledJobs();

    expect(result).toEqual({ runsFailed: 1, metadataReverted: 1 });
    expect(db.graphMetadata.update).toHaveBeenCalledWith({
      where: { graphId: 'g-stuck' },
      data: {
        status: GraphBuildStatus.Completed,
        buildProgress: expect.objectContaining({
          totalChunks: 42,
          processedChunks: 42,
          currentStep: 'Completed',
        }),
      },
    });
  });

  it('first-ever build (no graph, no resolved docs) routes full', async () => {
    (db.graphMetadata.findFirst as jest.Mock).mockResolvedValue(null);
    mockGetResolvedDocumentIds.mockResolvedValue([]);

    const result = await graphRouter.createCaller(ctx).buildGraph({
      documentIds: [docA, docB],
    });

    expect(result.status).toBe(GraphBuildStatus.Pending);
    expect(result.isRebuilding).toBe(false);
    expect(mockCreateGraphMetadata).toHaveBeenCalled();
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'graph-build',
      expect.objectContaining({ isIncremental: false, existingDocumentIds: [] })
    );
  });
});
