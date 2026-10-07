/**
 * Unit test for the resolution-failure gate in `runEntityResolution`.
 *
 * Headline invariant: when resolution leaves blocks undecided because their LLM
 * calls failed, the run must FAIL loudly rather than report success. The throw is
 * load-bearing — it is what makes the caller skip its
 * `markDocumentResolutionComplete` loop, so documents are never stamped resolved
 * when they aren't (and the incremental gate will revisit them on retry).
 *
 * Everything below `runEntityResolution` is mocked at the I/O boundary; the
 * resolution algorithm itself is covered by resolveEntitiesV2.test.ts.
 */
import type { Job } from 'bullmq';

import { runEntityResolution, handleBuildTerminalError } from '@/features/graph-database/utils/worker/worker';
import { resolveEntitiesV2 } from '@/features/graph-database/services/resolveEntitiesV2';
import { persistResolutions } from '@/features/graph-database/services/resolutionExecutor';
import { createBuildRun, completeBuildRun, failBuildRun, cancelBuildRun, cancelRunningBuildRunsForGraph } from '@/features/graph-database/dal/graphBuildRuns';
import { markDocumentPairResolved } from '@/features/graph-database/dal/documentResolutionPairs';
import { rollbackCancelledBuild } from '@/features/graph-database/dal/rollbackCancelledBuild';
import { settleFailedBuild } from '@/features/graph-database/dal/settleFailedBuild';
import { GraphBuildCancelledError, isGraphCancellationRequested, clearGraphCancellation } from '@/features/graph-database/utils/graphCancellation';
import { getGraphDatabaseSource } from '@/features/graph-database';
import { storage } from '@/server/storage/redis';
import type { GraphBuildJobData } from '@/features/graph-database/utils/worker/queue';
import type { Resolution, ExtractionRunStats } from '@/features/graph-database/types';

jest.mock('bullmq', () => ({ Worker: jest.fn() }));
jest.mock('@/server/logger');
jest.mock('@/server/db', () => ({ __esModule: true, default: { graphMetadata: { update: jest.fn(), findUnique: jest.fn() } } }));
jest.mock('@/server/storage/redis', () => ({ storage: { hset: jest.fn() } }));
jest.mock('@/server/storage/redisConnection', () => ({ getRedisClient: jest.fn() }));
jest.mock('@/features/graph-database', () => ({ getGraphDatabaseSource: jest.fn() }));
jest.mock('@/features/graph-database/services/resolveEntitiesV2', () => ({ resolveEntitiesV2: jest.fn() }));
jest.mock('@/features/graph-database/services/resolutionExecutor', () => ({ persistResolutions: jest.fn() }));
jest.mock('@/features/graph-database/dal/graphBuildRuns', () => ({
  createBuildRun: jest.fn(),
  completeBuildRun: jest.fn(),
  failBuildRun: jest.fn(),
  cancelBuildRun: jest.fn(),
  cancelRunningBuildRunsForGraph: jest.fn(),
}));
jest.mock('@/features/graph-database/dal/rollbackCancelledBuild', () => ({ rollbackCancelledBuild: jest.fn() }));
jest.mock('@/features/graph-database/dal/settleFailedBuild', () => ({ settleFailedBuild: jest.fn() }));
// Keep the real GraphBuildCancelledError class so instanceof routing in the
// worker still works; mock only the flag reads/writes.
jest.mock('@/features/graph-database/utils/graphCancellation', () => ({
  ...jest.requireActual('@/features/graph-database/utils/graphCancellation'),
  isGraphCancellationRequested: jest.fn(),
  clearGraphCancellation: jest.fn(),
}));
jest.mock('@/features/graph-database/dal/graphStats', () => ({
  updateExtractionStats: jest.fn(),
  updateResolutionStats: jest.fn(),
}));
jest.mock('@/features/graph-database/dal/documentResolutionPairs', () => ({ markDocumentPairResolved: jest.fn() }));

const mockResolveEntitiesV2 = resolveEntitiesV2 as jest.MockedFunction<typeof resolveEntitiesV2>;
const mockPersistResolutions = persistResolutions as jest.MockedFunction<typeof persistResolutions>;
const mockCreateBuildRun = createBuildRun as jest.MockedFunction<typeof createBuildRun>;
const mockCompleteBuildRun = completeBuildRun as jest.MockedFunction<typeof completeBuildRun>;
const mockFailBuildRun = failBuildRun as jest.MockedFunction<typeof failBuildRun>;
const mockCancelBuildRun = cancelBuildRun as jest.MockedFunction<typeof cancelBuildRun>;
const mockCancelRunningBuildRuns = cancelRunningBuildRunsForGraph as jest.MockedFunction<typeof cancelRunningBuildRunsForGraph>;
const mockMarkDocumentPairResolved = markDocumentPairResolved as jest.MockedFunction<typeof markDocumentPairResolved>;
const mockRollbackCancelledBuild = rollbackCancelledBuild as jest.MockedFunction<typeof rollbackCancelledBuild>;
const mockSettleFailedBuild = settleFailedBuild as jest.MockedFunction<typeof settleFailedBuild>;
const mockIsCancellationRequested = isGraphCancellationRequested as jest.MockedFunction<typeof isGraphCancellationRequested>;
const mockClearGraphCancellation = clearGraphCancellation as jest.MockedFunction<typeof clearGraphCancellation>;
const mockGetGraphDatabaseSource = getGraphDatabaseSource as jest.MockedFunction<typeof getGraphDatabaseSource>;

const RESOLUTION_RUN_ID = 'resolution-run-1';

/** One Neo4j record for the entity/concept load queries. */
function neoRecord(values: Record<string, unknown>) {
  return { get: (key: string) => values[key] };
}

/** A minimal cross-document IDENTITY edge, as persistResolutions would receive. */
function identityEdge(): Resolution {
  return {
    entity1: { id: 'e1', name: 'IBM', documentId: 'doc-new' },
    entity2: { id: 'e2', name: 'IBM', documentId: 'doc-existing' },
    edgeType: 'IDENTITY',
    confidence: 0.95,
    rationale: 'same',
    decidedBy: 'llm',
    signals: { cosineSimScore: 0.97, sharedAliases: [], sharedDoc: false },
    policy: 'resolution_v2_partition',
    policyVersion: 'test',
    resolvedAt: new Date('2024-01-01'),
  } as unknown as Resolution;
}

/** Incremental run: one new doc resolved against one already-graphed doc. */
function run() {
  return runEntityResolution('graph-1', 'user-1', ['doc-new'], 'job-1', true, ['doc-existing']);
}

describe('runEntityResolution — resolution failure gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateBuildRun.mockResolvedValue(RESOLUTION_RUN_ID);
    mockPersistResolutions.mockResolvedValue(undefined as never);
    // Extraction produced one entity, so the incremental path proceeds to resolve.
    mockGetGraphDatabaseSource.mockResolvedValue({
      run: jest.fn().mockResolvedValue({
        records: [neoRecord({ id: 'e1', name: 'IBM', type: 'ORGANIZATION', documentId: 'doc-new', mentionCount: 1 })],
      }),
    } as never);
  });

  it('fails the resolution run and throws when block LLM calls failed', async () => {
    mockResolveEntitiesV2.mockResolvedValue({ resolutions: [identityEdge()], failedCalls: 2 });

    await expect(run()).rejects.toThrow(/Resolution incomplete: 2 block LLM call\(s\) failed/);

    // The resolution build run is recorded as failed, against the right run id.
    expect(mockFailBuildRun).toHaveBeenCalledTimes(1);
    expect(mockFailBuildRun.mock.calls[0][0]).toBe(RESOLUTION_RUN_ID);

    // ...and the success path is never reached: no "completed" run, and no doc
    // pair marked resolved (which would let the incremental gate skip them).
    expect(mockCompleteBuildRun).not.toHaveBeenCalled();
    expect(mockMarkDocumentPairResolved).not.toHaveBeenCalled();
  });

  it('still persists the edges that were decided, so a retry completes rather than redoes', async () => {
    const edge = identityEdge();
    mockResolveEntitiesV2.mockResolvedValue({ resolutions: [edge], failedCalls: 1 });

    await expect(run()).rejects.toThrow();

    expect(mockPersistResolutions).toHaveBeenCalledWith([edge]);
  });

  it('completes normally on a genuine zero-resolution run (no failures) and returns its run id', async () => {
    mockResolveEntitiesV2.mockResolvedValue({ resolutions: [], failedCalls: 0 });

    await expect(run()).resolves.toBe(RESOLUTION_RUN_ID);

    expect(mockFailBuildRun).not.toHaveBeenCalled();
    expect(mockCompleteBuildRun).toHaveBeenCalledTimes(1);
    expect(mockMarkDocumentPairResolved).toHaveBeenCalledTimes(1);
  });
});

describe('handleBuildTerminalError — two-terminal-paths routing', () => {
  const EXTRACTION_RUN_ID = 'extraction-run-1';

  const stats: ExtractionRunStats = {
    chunksProcessed: 3,
    entitiesCreated: 5,
    entitiesMerged: 0,
    conceptsCreated: 2,
    relationshipsCreated: 4,
    skippedChunkIds: [],
    byDocument: {},
  };

  const makeJob = (attemptsMade: number, attempts = 2) =>
    ({
      data: {
        graphId: 'graph-1',
        userId: 'user-1',
        extractDocumentIds: ['doc-x', 'doc-y'],
        jobId: 'job-1',
      },
      attemptsMade,
      opts: { attempts },
    } as unknown as Job<GraphBuildJobData>);

  const call = (error: Error, job: Job<GraphBuildJobData>, resolutionRunId: string | null = null) =>
    handleBuildTerminalError({
      error,
      job,
      buildRunId: EXTRACTION_RUN_ID,
      resolutionRunId,
      extractionStats: stats,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsCancellationRequested.mockResolvedValue(false);
    mockRollbackCancelledBuild.mockResolvedValue(undefined);
    mockSettleFailedBuild.mockResolvedValue(undefined);
  });

  it('checkpoint throw: rolls back, flips BOTH run rows to cancelled by id, sweeps, clears the flag', async () => {
    const outcome = await call(new GraphBuildCancelledError('graph-1'), makeJob(0), RESOLUTION_RUN_ID);

    expect(outcome).toBe('cancelled');
    expect(mockRollbackCancelledBuild).toHaveBeenCalledWith({
      graphId: 'graph-1',
      userId: 'user-1',
      extractDocumentIds: ['doc-x', 'doc-y'],
    });
    // The by-id flips are what correct a mid-resolution cancel, where the
    // extraction/resolution rows already settled to `completed` for work the
    // rollback just undid — the sweep alone only converts `running` rows.
    expect(mockCancelBuildRun).toHaveBeenCalledWith(EXTRACTION_RUN_ID, stats);
    expect(mockCancelBuildRun).toHaveBeenCalledWith(RESOLUTION_RUN_ID);
    expect(mockCancelRunningBuildRuns).toHaveBeenCalledWith('graph-1');
    expect(mockClearGraphCancellation).toHaveBeenCalledWith('graph-1');
    expect(mockSettleFailedBuild).not.toHaveBeenCalled();
    expect(mockFailBuildRun).not.toHaveBeenCalled();
  });

  it('a cancel flag that raced a natural failure still routes to rollback, not preserve-for-retry', async () => {
    mockIsCancellationRequested.mockResolvedValue(true);

    const outcome = await call(new Error('LLM exploded'), makeJob(1));

    expect(outcome).toBe('cancelled');
    expect(mockRollbackCancelledBuild).toHaveBeenCalled();
    expect(mockSettleFailedBuild).not.toHaveBeenCalled();
  });

  it('non-final failure: fails the run row but does NOT settle — no transient false Completed between attempts', async () => {
    const outcome = await call(new Error('boom'), makeJob(0, 2));

    expect(outcome).toBe('retry');
    expect(mockFailBuildRun).toHaveBeenCalledWith(EXTRACTION_RUN_ID, 'boom', stats);
    expect(mockSettleFailedBuild).not.toHaveBeenCalled();
    expect(storage.hset).not.toHaveBeenCalled();
    // The flag stays readable so a cancel requested during the backoff still
    // kills the retry at its first checkpoint.
    expect(mockClearGraphCancellation).not.toHaveBeenCalled();
    expect(mockRollbackCancelledBuild).not.toHaveBeenCalled();
  });

  it('final failure: settles for resume with the errorMessage preserved and clears the flag', async () => {
    const outcome = await call(new Error('boom'), makeJob(1, 2));

    expect(outcome).toBe('failed');
    expect(mockFailBuildRun).toHaveBeenCalledWith(EXTRACTION_RUN_ID, 'boom', stats);
    expect(mockSettleFailedBuild).toHaveBeenCalledWith({
      graphId: 'graph-1',
      userId: 'user-1',
      extractDocumentIds: ['doc-x', 'doc-y'],
      errorMessage: 'boom',
    });
    expect(storage.hset).toHaveBeenCalledWith(
      'graph-job:job-1',
      expect.objectContaining({ status: 'failed', error: 'boom' })
    );
    expect(mockClearGraphCancellation).toHaveBeenCalledWith('graph-1');
    expect(mockRollbackCancelledBuild).not.toHaveBeenCalled();
  });

  it('cancel with no run rows created yet: still rolls back and sweeps, no by-id flips', async () => {
    const outcome = await handleBuildTerminalError({
      error: new GraphBuildCancelledError('graph-1'),
      job: makeJob(0),
      buildRunId: null,
      resolutionRunId: null,
      extractionStats: stats,
    });

    expect(outcome).toBe('cancelled');
    expect(mockCancelBuildRun).not.toHaveBeenCalled();
    expect(mockRollbackCancelledBuild).toHaveBeenCalled();
    expect(mockCancelRunningBuildRuns).toHaveBeenCalledWith('graph-1');
  });
});
