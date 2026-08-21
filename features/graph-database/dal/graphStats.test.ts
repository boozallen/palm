import {
  getGraphStats,
  updateExtractionStats,
  updateResolutionStats,
  resetGraphStats,
  getGraphHealthSummary,
} from '@/features/graph-database/dal/graphStats';

// Mock the Prisma client
jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    graphMetadata: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock the logger
jest.mock('@/server/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import db from '@/server/db';
import type { GraphMetadataStats } from '@/features/graph-database/types';

const mockDb = db as jest.Mocked<typeof db>;

const _createEmptyStats = (): GraphMetadataStats => ({
  extraction: {
    totalEntities: 0,
    totalConcepts: 0,
    totalChunks: 0,
    byDocument: {},
  },
  resolution: {
    totalIdentityEdges: 0,
    totalSimilarEdges: 0,
    totalCandidatesEvaluated: 0,
    documentPairsResolved: 0,
    lastRunAt: expect.any(String),
  },
  transitivity: {
    totalViolationsFixed: 0,
    currentViolations: 0,
    lastCheckedAt: expect.any(String),
  },
});

describe('graphStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getGraphStats', () => {
    it('should return stats if they exist', async () => {
      const mockStats: GraphMetadataStats = {
        extraction: { totalEntities: 10, totalConcepts: 5, totalChunks: 20, byDocument: {} },
        resolution: { totalIdentityEdges: 3, totalSimilarEdges: 2, totalCandidatesEvaluated: 15, documentPairsResolved: 1, lastRunAt: '2024-01-01' },
        transitivity: { totalViolationsFixed: 1, currentViolations: 0, lastCheckedAt: '2024-01-01' },
      };
      (mockDb.graphMetadata.findUnique as jest.Mock).mockResolvedValue({ stats: mockStats });

      const result = await getGraphStats('graph-123');

      expect(result).toEqual(mockStats);
    });

    it('should return null if no stats exist', async () => {
      (mockDb.graphMetadata.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await getGraphStats('graph-123');

      expect(result).toBeNull();
    });

    it('should return null if stats field is null', async () => {
      (mockDb.graphMetadata.findUnique as jest.Mock).mockResolvedValue({ stats: null });

      const result = await getGraphStats('graph-123');

      expect(result).toBeNull();
    });
  });

  describe('updateExtractionStats', () => {
    it('should add extraction stats to existing stats', async () => {
      const existingStats: GraphMetadataStats = {
        extraction: { totalEntities: 10, totalConcepts: 5, totalChunks: 20, byDocument: {} },
        resolution: { totalIdentityEdges: 0, totalSimilarEdges: 0, totalCandidatesEvaluated: 0, documentPairsResolved: 0, lastRunAt: '2024-01-01' },
        transitivity: { totalViolationsFixed: 0, currentViolations: 0, lastCheckedAt: '2024-01-01' },
      };
      (mockDb.graphMetadata.findUnique as jest.Mock).mockResolvedValue({ stats: existingStats });
      (mockDb.graphMetadata.update as jest.Mock).mockResolvedValue({});

      await updateExtractionStats('graph-123', {
        chunksProcessed: 5,
        entitiesCreated: 8,
        entitiesMerged: 0,
        conceptsCreated: 3,
        relationshipsCreated: 10,
        byDocument: { 'doc-1': { entities: 8, concepts: 3, chunks: 5, extractedAt: '2024-01-02' } },
      });

      expect(mockDb.graphMetadata.update).toHaveBeenCalledWith({
        where: { graphId: 'graph-123' },
        data: {
          stats: expect.objectContaining({
            extraction: expect.objectContaining({
              totalEntities: 18, // 10 + 8
              totalConcepts: 8, // 5 + 3
              totalChunks: 25, // 20 + 5
            }),
          }),
        },
      });
    });

    it('should initialize stats if none exist', async () => {
      (mockDb.graphMetadata.findUnique as jest.Mock).mockResolvedValue(null);
      (mockDb.graphMetadata.update as jest.Mock).mockResolvedValue({});

      await updateExtractionStats('graph-123', {
        chunksProcessed: 10,
        entitiesCreated: 20,
        entitiesMerged: 0,
        conceptsCreated: 15,
        relationshipsCreated: 10,
        byDocument: {},
      });

      expect(mockDb.graphMetadata.update).toHaveBeenCalledWith({
        where: { graphId: 'graph-123' },
        data: {
          stats: expect.objectContaining({
            extraction: expect.objectContaining({
              totalEntities: 20,
              totalConcepts: 15,
              totalChunks: 10,
            }),
          }),
        },
      });
    });
  });

  describe('updateResolutionStats', () => {
    it('should update resolution stats', async () => {
      const existingStats: GraphMetadataStats = {
        extraction: { totalEntities: 10, totalConcepts: 5, totalChunks: 20, byDocument: {} },
        resolution: { totalIdentityEdges: 5, totalSimilarEdges: 3, totalCandidatesEvaluated: 50, documentPairsResolved: 2, lastRunAt: '2024-01-01' },
        transitivity: { totalViolationsFixed: 0, currentViolations: 0, lastCheckedAt: '2024-01-01' },
      };
      (mockDb.graphMetadata.findUnique as jest.Mock).mockResolvedValue({ stats: existingStats });
      (mockDb.graphMetadata.update as jest.Mock).mockResolvedValue({});

      await updateResolutionStats('graph-123', {
        expectedDocPairs: 1,
        actualDocPairs: 1,
        candidatesGenerated: 20,
        identityEdges: 3,
        similarEdges: 2,
        relatedEdges: 1,
        unrelatedPairs: 14,
        avgConfidence: 0.9,
        minConfidence: 0.8,
        maxConfidence: 0.95,
        lowConfidenceIdentityCount: 0,
        duplicateResolutions: 0,
        decisionBreakdown: { identity: 3, similar: 2, related: 1, unrelated: 14 },
        byEntityType: {},
      });

      expect(mockDb.graphMetadata.update).toHaveBeenCalledWith({
        where: { graphId: 'graph-123' },
        data: {
          stats: expect.objectContaining({
            resolution: expect.objectContaining({
              totalIdentityEdges: 8, // 5 + 3
              totalSimilarEdges: 5, // 3 + 2
              totalCandidatesEvaluated: 70, // 50 + 20
              documentPairsResolved: 3, // 2 + 1
            }),
          }),
        },
      });
    });
  });

  describe('resetGraphStats', () => {
    it('should reset stats to empty', async () => {
      (mockDb.graphMetadata.update as jest.Mock).mockResolvedValue({});

      await resetGraphStats('graph-123');

      expect(mockDb.graphMetadata.update).toHaveBeenCalledWith({
        where: { graphId: 'graph-123' },
        data: {
          stats: expect.objectContaining({
            extraction: expect.objectContaining({ totalEntities: 0 }),
            resolution: expect.objectContaining({ totalIdentityEdges: 0 }),
            transitivity: expect.objectContaining({ totalViolationsFixed: 0 }),
          }),
        },
      });
    });
  });

  describe('getGraphHealthSummary', () => {
    it('should return health summary from stats', async () => {
      const mockStats: GraphMetadataStats = {
        extraction: {
          totalEntities: 100,
          totalConcepts: 50,
          totalChunks: 200,
          byDocument: {
            'doc-1': { entities: 50, concepts: 25, chunks: 100 },
            'doc-2': { entities: 50, concepts: 25, chunks: 100 },
          },
        },
        resolution: {
          totalIdentityEdges: 25,
          totalSimilarEdges: 15,
          totalCandidatesEvaluated: 300,
          documentPairsResolved: 3,
          lastRunAt: '2024-01-15',
        },
        transitivity: {
          totalViolationsFixed: 10,
          currentViolations: 2,
          lastCheckedAt: '2024-01-15',
        },
      };
      (mockDb.graphMetadata.findUnique as jest.Mock).mockResolvedValue({ stats: mockStats });

      const result = await getGraphHealthSummary('graph-123');

      expect(result).toEqual({
        documentsExtracted: 2,
        totalEntities: 100,
        totalConcepts: 50,
        identityEdges: 25,
        similarEdges: 15,
        currentViolations: 2,
        lastUpdated: '2024-01-15',
      });
    });

    it('should return null if no stats exist', async () => {
      (mockDb.graphMetadata.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await getGraphHealthSummary('graph-123');

      expect(result).toBeNull();
    });
  });
});
