import { GraphBuildStatus } from '@/features/graph-database/types';
import graphRouter from '@/features/graph-database/routes';
import createGraphMetadata from '@/features/graph-database/dal/createGraphMetadata';
import getGraphMetadata from '@/features/graph-database/dal/getGraphMetadata';
import verifyDocumentOwnership from '@/features/graph-database/dal/verifyDocumentOwnership';
import { getResolvedDocumentIds } from '@/features/graph-database/dal/getResolvedDocumentIds';
import { getExtractedDocumentIds } from '@/features/graph-database/dal/getExtractedDocumentIds';
import { isEntityResolutionEnabled } from '@/features/graph-database/utils/isEntityResolutionEnabled';
import { clearGraphCancellation } from '@/features/graph-database/utils/graphCancellation';
import db from '@/server/db';
import logger from '@/server/logger';
import { UserRole } from '@/features/shared/types/user';
import type { ContextType } from '@/server/trpc-context';

jest.mock('@/features/graph-database/dal/createGraphMetadata');
jest.mock('@/features/graph-database/dal/getGraphMetadata');
jest.mock('@/features/graph-database/dal/verifyDocumentOwnership');
jest.mock('@/features/graph-database/dal/getResolvedDocumentIds');
jest.mock('@/features/graph-database/dal/getExtractedDocumentIds');
jest.mock('@/features/graph-database/utils/isEntityResolutionEnabled');
jest.mock('@/features/graph-database/utils/graphCancellation', () => ({
  clearGraphCancellation: jest.fn(),
}));
jest.mock('@/libs/featureFlags');
jest.mock('@/server/db', () => ({
  graphMetadata: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  document: {
    findMany: jest.fn(),
  },
}));

const mockQueueAdd = jest.fn().mockResolvedValue(undefined);
jest.mock('@/features/graph-database/utils/worker/queue', () => ({
  getGraphBuildQueue: jest.fn(() => ({ add: mockQueueAdd })),
}));

const mockVerifyDocumentOwnership = verifyDocumentOwnership as jest.Mock;
const mockCreateGraphMetadata = createGraphMetadata as jest.Mock;
const mockGetGraphMetadata = getGraphMetadata as jest.Mock;
const mockGetResolvedDocumentIds = getResolvedDocumentIds as jest.Mock;
const mockGetExtractedDocumentIds = getExtractedDocumentIds as jest.Mock;
const mockIsEntityResolutionEnabled = isEntityResolutionEnabled as jest.MockedFunction<
  typeof isEntityResolutionEnabled
>;
const mockClearGraphCancellation = clearGraphCancellation as jest.Mock;
const mockDbGraphMetadata = db.graphMetadata as jest.Mocked<typeof db.graphMetadata>;
const mockDbDocument = db.document as jest.Mocked<typeof db.document>;

/**
 * The gate calls findFirst twice: once for the in-flight guard (where.status is
 * an `{ in: [...] }` filter over the non-terminal statuses) and once to find the
 * user's existing graph to extend (no status filter). This helper routes each
 * call to the right fixture.
 */
const mockFindFirst = ({
  building = null,
  existing = null,
}: { building?: object | null; existing?: object | null }) => {
  (mockDbGraphMetadata.findFirst as jest.Mock).mockImplementation(
    async ({ where }: { where: { status?: unknown } }) => {
      if (where?.status) {
        return building;
      }
      return existing;
    }
  );
};

describe('build-graph route', () => {
  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockDocumentIds = [
    '550e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440003',
  ];

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default to the resolution-enabled path so routing reads resolved-state.
    mockIsEntityResolutionEnabled.mockResolvedValue(true);

    mockVerifyDocumentOwnership.mockResolvedValue(true);
    mockCreateGraphMetadata.mockResolvedValue({ graphId: 'graph-new-123' });
    mockGetGraphMetadata.mockResolvedValue(null);
    mockGetResolvedDocumentIds.mockResolvedValue([]);
    mockGetExtractedDocumentIds.mockResolvedValue([]);
    mockFindFirst({ building: null, existing: null });
    (mockDbGraphMetadata.update as jest.Mock).mockResolvedValue({});
    // document.findMany echoes back the requested ids as still-live documents
    (mockDbDocument.findMany as jest.Mock).mockImplementation(async ({ where }) => {
      const ids = where?.id?.in || [];
      return ids.map((id: string) => ({ id }));
    });

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
      logger: logger,
    } as unknown as ContextType;
  });

  describe('Document ownership verification', () => {
    it('should verify user owns all requested documents', async () => {
      const caller = graphRouter.createCaller(ctx);
      await caller.buildGraph({ documentIds: mockDocumentIds });

      expect(mockVerifyDocumentOwnership).toHaveBeenCalledWith(mockUserId, mockDocumentIds);
    });

    it('should throw error if user does not own all documents', async () => {
      mockVerifyDocumentOwnership.mockResolvedValue(false);

      const caller = graphRouter.createCaller(ctx);

      await expect(caller.buildGraph({ documentIds: mockDocumentIds })).rejects.toThrow(
        'You do not have access to all requested documents'
      );
    });

    it('should require at least one document', async () => {
      const caller = graphRouter.createCaller(ctx);

      await expect(caller.buildGraph({ documentIds: [] })).rejects.toThrow();
    });
  });

  describe('New graph creation (no existing graph)', () => {
    it('should create a new graph when user has no existing graph', async () => {
      const caller = graphRouter.createCaller(ctx);
      const result = await caller.buildGraph({ documentIds: mockDocumentIds });

      expect(result.status).toBe(GraphBuildStatus.Pending);
      expect(result.isRebuilding).toBe(false);
      expect(result.graphId).toBeDefined();
      expect(mockCreateGraphMetadata).toHaveBeenCalled();
    });

    it('should queue a full (non-incremental) build for a genuine first build', async () => {
      const caller = graphRouter.createCaller(ctx);
      await caller.buildGraph({ documentIds: mockDocumentIds });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'graph-build',
        expect.objectContaining({
          documentIds: mockDocumentIds,
          isIncremental: false,
          existingDocumentIds: [],
        })
      );
    });

    it('should generate deterministic graphId based on document set', async () => {
      const caller = graphRouter.createCaller(ctx);
      const result = await caller.buildGraph({ documentIds: mockDocumentIds });

      expect(result.graphId).toContain('graph_');
      expect(result.graphId).toContain(mockUserId);
    });

    it('should return estimated time based on document count', async () => {
      const caller = graphRouter.createCaller(ctx);
      const result = await caller.buildGraph({ documentIds: mockDocumentIds });

      expect(result.estimatedTimeSeconds).toBeDefined();
      expect(result.estimatedTimeSeconds).toBeGreaterThan(0);
    });

    it('should clear any stale cancellation flag for the new graphId before queuing', async () => {
      const caller = graphRouter.createCaller(ctx);
      const result = await caller.buildGraph({ documentIds: mockDocumentIds });

      expect(mockClearGraphCancellation).toHaveBeenCalledWith(result.graphId);
    });
  });

  describe('Graph reuse (exact match)', () => {
    it('should return existing completed graph if exact document set already graphed', async () => {
      mockGetGraphMetadata.mockImplementation((graphId: string) => {
        return Promise.resolve({
          graphId,
          status: GraphBuildStatus.Completed,
          documentIds: mockDocumentIds,
        });
      });

      const caller = graphRouter.createCaller(ctx);
      const result = await caller.buildGraph({ documentIds: mockDocumentIds });

      expect(result.status).toBe(GraphBuildStatus.Completed);
      expect(result.isRebuilding).toBe(false);
      expect(mockCreateGraphMetadata).not.toHaveBeenCalled();
    });

    it('should return in-progress status if exact graph is still building', async () => {
      mockGetGraphMetadata.mockImplementation((graphId: string) => {
        return Promise.resolve({
          graphId,
          status: GraphBuildStatus.Building,
          documentIds: mockDocumentIds,
        });
      });

      const caller = graphRouter.createCaller(ctx);
      const result = await caller.buildGraph({ documentIds: mockDocumentIds });

      expect(result.status).toBe(GraphBuildStatus.Building);
      expect(result.isRebuilding).toBe(false);
    });
  });

  describe('Concurrent build guard', () => {
    it('should return Building status without queuing a new job when a build is already in progress', async () => {
      const buildingGraph = {
        graphId: 'graph-already-building',
        status: GraphBuildStatus.Building,
        documentIds: mockDocumentIds,
        userId: mockUserId,
      };
      mockFindFirst({ building: buildingGraph });

      const caller = graphRouter.createCaller(ctx);
      const result = await caller.buildGraph({ documentIds: mockDocumentIds });

      expect(result.status).toBe(GraphBuildStatus.Building);
      expect(result.graphId).toBe('graph-already-building');
      expect(mockQueueAdd).not.toHaveBeenCalled();
    });

    it('should block a single-document library call while a multi-document build is running', async () => {
      const buildingGraph = {
        graphId: 'graph-25-docs-building',
        status: GraphBuildStatus.Building,
        documentIds: mockDocumentIds,
        userId: mockUserId,
      };
      mockFindFirst({ building: buildingGraph });

      const caller = graphRouter.createCaller(ctx);
      const result = await caller.buildGraph({ documentIds: [mockDocumentIds[0]] });

      expect(result.status).toBe(GraphBuildStatus.Building);
      expect(mockQueueAdd).not.toHaveBeenCalled();
      expect(mockCreateGraphMetadata).not.toHaveBeenCalled();
    });

    it.each([
      GraphBuildStatus.Pending,
      GraphBuildStatus.Resolving,
      GraphBuildStatus.Cancelling,
    ])('should block a new build while a graph is %s — never enqueue or clear the cancel flag over an in-flight build', async (status) => {
      const inFlightGraph = {
        graphId: 'graph-in-flight',
        status,
        documentIds: mockDocumentIds,
        userId: mockUserId,
      };
      mockFindFirst({ building: inFlightGraph });

      const caller = graphRouter.createCaller(ctx);
      const result = await caller.buildGraph({ documentIds: mockDocumentIds });

      expect(result.status).toBe(status);
      expect(result.graphId).toBe('graph-in-flight');
      expect(mockQueueAdd).not.toHaveBeenCalled();
      // The invariant behind guarding Cancelling specifically: clearing the
      // cancellation flag here would delete the very flag the in-flight
      // worker's checkpoints read, silently defeating the user's cancel.
      expect(mockClearGraphCancellation).not.toHaveBeenCalled();
    });
  });

  describe('Incremental graph build (routed off resolved-state)', () => {
    const existingGraphDocs = [
      '550e8400-e29b-41d4-a716-446655440001',
      '550e8400-e29b-41d4-a716-446655440002',
    ];
    const newDocs = [
      '550e8400-e29b-41d4-a716-446655440003',
      '550e8400-e29b-41d4-a716-446655440004',
    ];
    const allDocs = [...existingGraphDocs, ...newDocs];

    const completedGraph = {
      graphId: 'graph-existing-inc',
      status: GraphBuildStatus.Completed,
      documentIds: existingGraphDocs,
      userId: mockUserId,
    };

    beforeEach(() => {
      // Base docs are extracted AND resolved (a resolved doc is always extracted).
      // The gate routes extraction off the extraction marker and resolution off the
      // resolution marker, so both must reflect the base set.
      mockGetExtractedDocumentIds.mockResolvedValue(existingGraphDocs);
    });

    it('should trigger incremental build when adding docs to an existing graph', async () => {
      mockFindFirst({ existing: completedGraph });
      mockGetResolvedDocumentIds.mockResolvedValue(existingGraphDocs);

      const caller = graphRouter.createCaller(ctx);
      const result = await caller.buildGraph({ documentIds: allDocs });

      expect(result.isRebuilding).toBe(true);
      expect(result.status).toBe(GraphBuildStatus.Building);
      expect(result.graphId).toBe('graph-existing-inc');
    });

    it('should queue only the new documents and resolve them against the resolved base', async () => {
      mockFindFirst({ existing: completedGraph });
      mockGetResolvedDocumentIds.mockResolvedValue(existingGraphDocs);

      const caller = graphRouter.createCaller(ctx);
      await caller.buildGraph({ documentIds: allDocs });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'graph-build',
        expect.objectContaining({
          graphId: 'graph-existing-inc',
          documentIds: newDocs,
          extractDocumentIds: newDocs, // the new docs need extraction
          isIncremental: true,
          existingDocumentIds: existingGraphDocs,
        })
      );
    });

    it('should store the merged (existing + new) document membership on the graph', async () => {
      mockFindFirst({ existing: completedGraph });
      mockGetResolvedDocumentIds.mockResolvedValue(existingGraphDocs);

      const caller = graphRouter.createCaller(ctx);
      await caller.buildGraph({ documentIds: allDocs });

      expect(mockDbGraphMetadata.update).toHaveBeenCalledWith({
        where: { graphId: completedGraph.graphId },
        data: {
          status: GraphBuildStatus.Building,
          documentIds: allDocs.sort(),
          errorMessage: null,
        },
      });
    });

    it('should return existing graph immediately if all requested docs are already resolved', async () => {
      mockFindFirst({ existing: completedGraph });
      mockGetResolvedDocumentIds.mockResolvedValue(existingGraphDocs);

      const caller = graphRouter.createCaller(ctx);
      const result = await caller.buildGraph({ documentIds: existingGraphDocs });

      expect(result.isRebuilding).toBe(false);
      expect(result.status).toBe(GraphBuildStatus.Completed);
      expect(result.jobId).toBe('');
      expect(mockQueueAdd).not.toHaveBeenCalled();
    });

    it('should verify ownership of the new documents only', async () => {
      mockFindFirst({ existing: completedGraph });
      mockGetResolvedDocumentIds.mockResolvedValue(existingGraphDocs);

      const caller = graphRouter.createCaller(ctx);
      await caller.buildGraph({ documentIds: allDocs });

      // Once for the top-level ownership check, once for the new docs
      expect(mockVerifyDocumentOwnership).toHaveBeenCalledTimes(2);
      expect(mockVerifyDocumentOwnership).toHaveBeenLastCalledWith(mockUserId, newDocs);
    });

    it('should return previousGraphId when rebuilding', async () => {
      mockFindFirst({ existing: completedGraph });
      mockGetResolvedDocumentIds.mockResolvedValue(existingGraphDocs);

      const caller = graphRouter.createCaller(ctx);
      const result = await caller.buildGraph({ documentIds: allDocs });

      expect(result.previousGraphId).toBe('graph-existing-inc');
    });

    it('should clear any stale cancellation flag for the existing graphId before queuing', async () => {
      mockFindFirst({ existing: completedGraph });
      mockGetResolvedDocumentIds.mockResolvedValue(existingGraphDocs);

      const caller = graphRouter.createCaller(ctx);
      await caller.buildGraph({ documentIds: allDocs });

      expect(mockClearGraphCancellation).toHaveBeenCalledWith(completedGraph.graphId);
    });
  });

  describe('Crashed-build routing (the demotion regression)', () => {
    const doc1 = '550e8400-e29b-41d4-a716-446655440001';
    const doc2 = '550e8400-e29b-41d4-a716-446655440002';
    const doc3 = '550e8400-e29b-41d4-a716-446655440003';
    const resolvedDocs = [doc1, doc2];

    beforeEach(() => {
      // doc1/doc2 are in the graph and therefore extracted; their resolution state
      // varies per test. doc3 is brand new (neither extracted nor resolved).
      mockGetExtractedDocumentIds.mockResolvedValue([doc1, doc2]);
    });

    it('should route incremental (NOT whole-corpus) when the graph is stuck in Resolving with no Completed row', async () => {
      // A build died mid-resolution: the graph row is stuck in Resolving and
      // there is NO Completed row, but doc1/doc2 kept their resolutionComplete
      // markers. The gate must read those markers and stay incremental.
      const stuckGraph = {
        graphId: 'graph-stuck-resolving',
        status: GraphBuildStatus.Resolving,
        documentIds: resolvedDocs,
        userId: mockUserId,
      };
      mockFindFirst({ existing: stuckGraph });
      mockGetResolvedDocumentIds.mockResolvedValue(resolvedDocs);

      const caller = graphRouter.createCaller(ctx);
      const result = await caller.buildGraph({ documentIds: [doc1, doc2, doc3] });

      expect(result.isRebuilding).toBe(true);
      expect(result.status).toBe(GraphBuildStatus.Building);
      expect(result.graphId).toBe('graph-stuck-resolving');

      // The fix: incremental routing scoped to the resolved base — only doc3 is
      // new, and resolution runs against [doc1, doc2], NOT the whole corpus.
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'graph-build',
        expect.objectContaining({
          graphId: 'graph-stuck-resolving',
          documentIds: [doc3],
          extractDocumentIds: [doc3], // only the genuinely-new doc is extracted
          isIncremental: true,
          existingDocumentIds: resolvedDocs,
        })
      );
      // It must NOT fall through to a fresh whole-corpus build
      expect(mockCreateGraphMetadata).not.toHaveBeenCalled();
    });

    it('should resolve an extracted-but-unresolved doc WITHOUT re-extracting it', async () => {
      // doc1/doc2 are both extracted (in the graph) but resolution crashed before
      // doc2, so only doc1 is resolution-complete. doc2 must be resolved — never
      // re-extracted. The gate routes it resolve-only: it is in the pending
      // `documentIds` (to resolve) but NOT in `extractDocumentIds`.
      const stuckGraph = {
        graphId: 'graph-half-resolved',
        status: GraphBuildStatus.Resolving,
        documentIds: [doc1, doc2],
        userId: mockUserId,
      };
      mockFindFirst({ existing: stuckGraph });
      mockGetResolvedDocumentIds.mockResolvedValue([doc1]);

      const caller = graphRouter.createCaller(ctx);
      await caller.buildGraph({ documentIds: [doc1, doc2] });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'graph-build',
        expect.objectContaining({
          documentIds: [doc2],
          extractDocumentIds: [], // resolve-only: doc2 is already extracted
          isIncremental: true,
          existingDocumentIds: [doc1],
        })
      );
    });
  });

  describe('Extraction vs resolution routing (no re-extraction of graphed docs)', () => {
    const doc1 = '550e8400-e29b-41d4-a716-446655440001'; // extracted + resolved
    const doc2 = '550e8400-e29b-41d4-a716-446655440002'; // extracted, NOT resolved
    const doc3 = '550e8400-e29b-41d4-a716-446655440003'; // brand new

    it('extracts only the genuinely-new doc while resolving an extracted-but-unresolved one', async () => {
      // The exact scenario behind the "why is my already-graphed doc graphing?"
      // report: a graphed-but-unresolved doc (doc2) is still selected when the user
      // graphs a new doc (doc3). doc2 must be resolved, never re-extracted.
      const existingGraph = {
        graphId: 'graph-mixed',
        status: GraphBuildStatus.Completed,
        documentIds: [doc1, doc2],
        userId: mockUserId,
      };
      mockFindFirst({ existing: existingGraph });
      mockGetExtractedDocumentIds.mockResolvedValue([doc1, doc2]);
      mockGetResolvedDocumentIds.mockResolvedValue([doc1]);

      const caller = graphRouter.createCaller(ctx);
      await caller.buildGraph({ documentIds: [doc2, doc3] });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'graph-build',
        expect.objectContaining({
          // Only doc3 is extracted — the already-graphed doc2 is NOT re-extracted.
          extractDocumentIds: [doc3],
          // Both resolved this run: doc2 finishes resolution, doc3 is new.
          documentIds: [doc2, doc3],
          isIncremental: true,
        })
      );
    });

    it('runs resolve-only (empty extract set) when every selected doc is already extracted', async () => {
      const existingGraph = {
        graphId: 'graph-all-extracted',
        status: GraphBuildStatus.Completed,
        documentIds: [doc1, doc2],
        userId: mockUserId,
      };
      mockFindFirst({ existing: existingGraph });
      mockGetExtractedDocumentIds.mockResolvedValue([doc1, doc2]);
      mockGetResolvedDocumentIds.mockResolvedValue([]); // neither resolved yet

      const caller = graphRouter.createCaller(ctx);
      await caller.buildGraph({ documentIds: [doc1, doc2] });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'graph-build',
        expect.objectContaining({
          extractDocumentIds: [], // nothing to extract
          documentIds: [doc1, doc2], // both resolved
          isIncremental: true,
        })
      );
    });
  });

  describe('Resolution disabled (ENTITY_RESOLUTION off)', () => {
    const doc1 = '550e8400-e29b-41d4-a716-446655440001';
    const doc2 = '550e8400-e29b-41d4-a716-446655440002';
    const doc3 = '550e8400-e29b-41d4-a716-446655440003';

    beforeEach(() => {
      mockIsEntityResolutionEnabled.mockResolvedValue(false); // resolution disabled
      // With resolution off, nothing is ever resolution-complete; "done" for
      // routing derives from the extraction marker instead.
      mockGetResolvedDocumentIds.mockResolvedValue([]);
      mockGetExtractedDocumentIds.mockResolvedValue([doc1, doc2]);
    });

    it('should route incremental off extraction state (no demotion to a new graph)', async () => {
      const existingGraph = {
        graphId: 'graph-extracted-only',
        status: GraphBuildStatus.Completed,
        documentIds: [doc1, doc2],
        userId: mockUserId,
      };
      mockFindFirst({ existing: existingGraph });

      const caller = graphRouter.createCaller(ctx);
      const result = await caller.buildGraph({ documentIds: [doc1, doc2, doc3] });

      expect(result.isRebuilding).toBe(true);
      expect(result.graphId).toBe('graph-extracted-only');
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'graph-build',
        expect.objectContaining({
          documentIds: [doc3],
          isIncremental: true,
        })
      );
      expect(mockCreateGraphMetadata).not.toHaveBeenCalled();
    });

    it('should NOT re-queue a build when all requested docs are already in the graph', async () => {
      const existingGraph = {
        graphId: 'graph-extracted-only',
        status: GraphBuildStatus.Completed,
        documentIds: [doc1, doc2],
        userId: mockUserId,
      };
      mockFindFirst({ existing: existingGraph });

      const caller = graphRouter.createCaller(ctx);
      const result = await caller.buildGraph({ documentIds: [doc1, doc2] });

      expect(result.status).toBe(GraphBuildStatus.Completed);
      expect(result.isRebuilding).toBe(false);
      expect(mockQueueAdd).not.toHaveBeenCalled();
    });

    it('should re-queue an un-extracted doc from a crashed base instead of skipping it', async () => {
      // Base graph lists doc1 + doc2, but a mid-extraction crash left only doc1
      // extraction-complete. Routing must derive "done" from the extraction
      // marker (doc1), not graph membership (doc1, doc2), so doc2 is re-queued.
      const existingGraph = {
        graphId: 'graph-partial-extraction',
        status: GraphBuildStatus.Failed,
        documentIds: [doc1, doc2],
        userId: mockUserId,
      };
      mockFindFirst({ existing: existingGraph });
      mockGetExtractedDocumentIds.mockResolvedValue([doc1]); // doc2 never finished extracting

      const caller = graphRouter.createCaller(ctx);
      const result = await caller.buildGraph({ documentIds: [doc1, doc2] });

      expect(result.isRebuilding).toBe(true);
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'graph-build',
        expect.objectContaining({
          documentIds: [doc2], // the un-extracted doc, not treated as done
          isIncremental: true,
        })
      );
      expect(mockCreateGraphMetadata).not.toHaveBeenCalled();
    });
  });

  describe('schemaKey threading', () => {
    it('passes schemaKey to queue.add for a new build', async () => {
      (mockDbGraphMetadata.findFirst as jest.Mock).mockResolvedValue(null);
      mockGetGraphMetadata.mockResolvedValue(null);

      const { getGraphBuildQueue } = require('@/features/graph-database/utils/worker/queue');
      const mockAdd = jest.fn().mockResolvedValue(undefined);
      getGraphBuildQueue.mockReturnValue({ add: mockAdd });

      const caller = graphRouter.createCaller(ctx);
      await caller.buildGraph({ documentIds: mockDocumentIds, schemaKey: 'government-pursuit' });

      expect(mockAdd).toHaveBeenCalledWith(
        'graph-build',
        expect.objectContaining({ schemaKey: 'government-pursuit', isIncremental: false })
      );
    });

    it('passes schemaKey to queue.add for an incremental build', async () => {
      const existingGraph = {
        graphId: 'graph-schema-inc',
        status: GraphBuildStatus.Completed,
        documentIds: ['550e8400-e29b-41d4-a716-446655440001'],
        userId: mockUserId,
      };
      mockFindFirst({ existing: existingGraph });

      const { getGraphBuildQueue } = require('@/features/graph-database/utils/worker/queue');
      const mockAdd = jest.fn().mockResolvedValue(undefined);
      getGraphBuildQueue.mockReturnValue({ add: mockAdd });

      const caller = graphRouter.createCaller(ctx);
      await caller.buildGraph({
        documentIds: [
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002',
        ],
        schemaKey: 'government-pursuit',
      });

      expect(mockAdd).toHaveBeenCalledWith(
        'graph-build',
        expect.objectContaining({ schemaKey: 'government-pursuit', isIncremental: true })
      );
    });

    it('omits schemaKey (undefined) when not provided', async () => {
      (mockDbGraphMetadata.findFirst as jest.Mock).mockResolvedValue(null);
      mockGetGraphMetadata.mockResolvedValue(null);

      const { getGraphBuildQueue } = require('@/features/graph-database/utils/worker/queue');
      const mockAdd = jest.fn().mockResolvedValue(undefined);
      getGraphBuildQueue.mockReturnValue({ add: mockAdd });

      const caller = graphRouter.createCaller(ctx);
      await caller.buildGraph({ documentIds: mockDocumentIds });

      expect(mockAdd).toHaveBeenCalledWith(
        'graph-build',
        expect.objectContaining({ schemaKey: undefined })
      );
    });
  });

  describe('schemaKeysByDocumentId threading', () => {
    const schemaMap = {
      '550e8400-e29b-41d4-a716-446655440001': 'government-pursuit',
      '550e8400-e29b-41d4-a716-446655440002': 'general',
    };

    it('passes schemaKeysByDocumentId to queue.add for a new build', async () => {
      (mockDbGraphMetadata.findFirst as jest.Mock).mockResolvedValue(null);
      mockGetGraphMetadata.mockResolvedValue(null);

      const { getGraphBuildQueue } = require('@/features/graph-database/utils/worker/queue');
      const mockAdd = jest.fn().mockResolvedValue(undefined);
      getGraphBuildQueue.mockReturnValue({ add: mockAdd });

      const caller = graphRouter.createCaller(ctx);
      await caller.buildGraph({ documentIds: mockDocumentIds, schemaKeysByDocumentId: schemaMap });

      expect(mockAdd).toHaveBeenCalledWith(
        'graph-build',
        expect.objectContaining({ schemaKeysByDocumentId: schemaMap, isIncremental: false })
      );
    });

    it('passes schemaKeysByDocumentId to queue.add for an incremental build', async () => {
      const existingGraph = {
        graphId: 'graph-schema-map-inc',
        status: GraphBuildStatus.Completed,
        documentIds: ['550e8400-e29b-41d4-a716-446655440001'],
        userId: mockUserId,
      };
      mockFindFirst({ existing: existingGraph });

      const { getGraphBuildQueue } = require('@/features/graph-database/utils/worker/queue');
      const mockAdd = jest.fn().mockResolvedValue(undefined);
      getGraphBuildQueue.mockReturnValue({ add: mockAdd });

      const caller = graphRouter.createCaller(ctx);
      await caller.buildGraph({
        documentIds: [
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002',
        ],
        schemaKeysByDocumentId: schemaMap,
      });

      expect(mockAdd).toHaveBeenCalledWith(
        'graph-build',
        expect.objectContaining({ schemaKeysByDocumentId: schemaMap, isIncremental: true })
      );
    });

    it('omits schemaKeysByDocumentId (undefined) when not provided', async () => {
      (mockDbGraphMetadata.findFirst as jest.Mock).mockResolvedValue(null);
      mockGetGraphMetadata.mockResolvedValue(null);

      const { getGraphBuildQueue } = require('@/features/graph-database/utils/worker/queue');
      const mockAdd = jest.fn().mockResolvedValue(undefined);
      getGraphBuildQueue.mockReturnValue({ add: mockAdd });

      const caller = graphRouter.createCaller(ctx);
      await caller.buildGraph({ documentIds: mockDocumentIds });

      expect(mockAdd).toHaveBeenCalledWith(
        'graph-build',
        expect.objectContaining({ schemaKeysByDocumentId: undefined })
      );
    });
  });

  describe('Error handling', () => {
    it('should handle queue unavailability gracefully', async () => {
      const { getGraphBuildQueue } = require('@/features/graph-database/utils/worker/queue');
      getGraphBuildQueue.mockReturnValueOnce(null);

      const caller = graphRouter.createCaller(ctx);

      await expect(caller.buildGraph({ documentIds: mockDocumentIds })).rejects.toThrow(
        'Graph build service is not available'
      );
    });

    it('should reject invalid document IDs', async () => {
      const caller = graphRouter.createCaller(ctx);

      await expect(
        caller.buildGraph({ documentIds: ['not-a-uuid'] })
      ).rejects.toThrow();
    });
  });

  describe('Logging', () => {
    it('should log graph build request', async () => {
      const loggerSpy = jest.spyOn(logger, 'info');

      const caller = graphRouter.createCaller(ctx);
      await caller.buildGraph({ documentIds: mockDocumentIds });

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Graph build requested')
      );
    });

    it('should log incremental check info', async () => {
      const loggerSpy = jest.spyOn(logger, 'info');

      const existingGraph = {
        graphId: 'graph-log-inc',
        status: GraphBuildStatus.Completed,
        documentIds: ['550e8400-e29b-41d4-a716-446655440051'],
        userId: mockUserId,
      };
      mockFindFirst({ existing: existingGraph });
      mockGetResolvedDocumentIds.mockResolvedValue(['550e8400-e29b-41d4-a716-446655440051']);

      const caller = graphRouter.createCaller(ctx);
      await caller.buildGraph({
        documentIds: [
          '550e8400-e29b-41d4-a716-446655440051',
          '550e8400-e29b-41d4-a716-446655440052',
        ],
      });

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Incremental check')
      );
    });
  });
});
