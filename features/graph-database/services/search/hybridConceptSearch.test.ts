import { hybridConceptSearch, HybridConceptSearchParams } from './hybridConceptSearch';
import { getGraphDatabaseSource } from '@/features/graph-database';
import getConceptsForQuery from '@/features/chat/dal/getConceptsForQuery';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn().mockResolvedValue({
    run: jest.fn().mockResolvedValue({ records: [] }),
  }),
}));

jest.mock('@/features/chat/dal/getConceptsForQuery', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/server/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

const defaultParams: HybridConceptSearchParams = {
  extractedTerms: ['AI Act'],
  documentIds: ['doc-1'],
  accessibleDocIds: new Set(['doc-1']) as unknown as AccessibleDocIds,
  embeddedQuery: [0.1, 0.2],
  maxResults: 10,
};

describe('hybridConceptSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({
      run: jest.fn().mockResolvedValue({ records: [] }),
    });
    (getConceptsForQuery as jest.Mock).mockResolvedValue([]);
  });

  it('returns empty array when both legs return nothing', async () => {
    const result = await hybridConceptSearch(defaultParams);
    expect(result).toEqual([]);
  });

  it('returns vector-only results when BM25 returns nothing', async () => {
    (getConceptsForQuery as jest.Mock).mockResolvedValue([
      { id: 'c1', conceptName: 'Concept A', description: '', category: 'tech', documentId: 'doc-1', score: 0.9 },
    ]);
    const result = await hybridConceptSearch(defaultParams);
    expect(result).toHaveLength(1);
    expect(result[0].conceptName).toBe('Concept A');
  });

  it('maps node.name to conceptName for BM25 results', async () => {
    const mockRun = jest.fn().mockResolvedValue({
      records: [{
        get: (field: string) => ({
          id: 'bm25-c1',
          name: 'BM25 Concept',
          description: 'desc',
          category: 'cat',
          documentId: 'doc-1',
        }[field]),
      }],
    });
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({ run: mockRun });
    const result = await hybridConceptSearch(defaultParams);
    const bm25Result = result.find(r => r.id === 'bm25-c1');
    expect(bm25Result?.conceptName).toBe('BM25 Concept');
  });

  it('falls back to vector when BM25 throws', async () => {
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({
      run: jest.fn().mockRejectedValue(new Error('Neo4j down')),
    });
    (getConceptsForQuery as jest.Mock).mockResolvedValue([
      { id: 'c1', conceptName: 'Concept A', description: '', category: 'tech', documentId: 'doc-1', score: 0.9 },
    ]);
    const result = await hybridConceptSearch(defaultParams);
    expect(result).toHaveLength(1);
    expect(result[0].conceptName).toBe('Concept A');
  });

  it('uses vector-only when extractedTerms is empty', async () => {
    (getConceptsForQuery as jest.Mock).mockResolvedValue([
      { id: 'c1', conceptName: 'Concept A', description: '', category: 'tech', documentId: 'doc-1', score: 0.9 },
    ]);
    const result = await hybridConceptSearch({ ...defaultParams, extractedTerms: [] });
    expect(result).toHaveLength(1);
    expect(getGraphDatabaseSource).not.toHaveBeenCalled();
  });

  it('respects maxResults cutoff', async () => {
    const manyConcepts = Array.from({ length: 20 }, (_, i) => ({
      id: `c${i}`,
      conceptName: `Concept ${i}`,
      description: '',
      category: 'tech',
      documentId: 'doc-1',
      score: 0.5,
    }));
    (getConceptsForQuery as jest.Mock).mockResolvedValue(manyConcepts);
    const result = await hybridConceptSearch({ ...defaultParams, maxResults: 5 });
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('merges BM25 and vector results with RRF', async () => {
    const mockRun = jest.fn().mockResolvedValue({
      records: [{
        get: (field: string) => ({
          id: 'bm25-only',
          name: 'BM25 Concept',
          description: '',
          category: '',
          documentId: 'doc-1',
        }[field]),
      }],
    });
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({ run: mockRun });
    (getConceptsForQuery as jest.Mock).mockResolvedValue([
      { id: 'vector-only', conceptName: 'Vector Concept', description: '', category: 'tech', documentId: 'doc-1', score: 0.8 },
    ]);
    const result = await hybridConceptSearch(defaultParams);
    expect(result.length).toBeGreaterThan(0);
  });

  // Tenancy: the scope arguments that drive document isolation must reach EVERY
  // retrieval leg — dropping one would leak cross-document concepts to the agent.
  // True exclusion (real filtering) is proven in __tests__/integration (live DB);
  // here we assert the scope arguments are supplied (catches a dropped filter arg).
  describe('tenancy scoping', () => {
    it('passes $documentIds to every Neo4j leg (exact match + BM25)', async () => {
      const mockRun = jest.fn().mockResolvedValue({ records: [] });
      (getGraphDatabaseSource as jest.Mock).mockResolvedValue({ run: mockRun });
      await hybridConceptSearch(defaultParams);
      expect(mockRun).toHaveBeenCalled();
      for (const call of mockRun.mock.calls) {
        expect(call[1]).toEqual(expect.objectContaining({ documentIds: defaultParams.documentIds }));
      }
    });

    it('passes documentIds + accessibleDocIds to the pgvector leg', async () => {
      await hybridConceptSearch(defaultParams);
      expect(getConceptsForQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          documentIds: defaultParams.documentIds,
          accessibleDocIds: defaultParams.accessibleDocIds,
        }),
      );
    });

    it('still scopes the vector-only fallback (no extracted terms) by documentIds + accessibleDocIds', async () => {
      await hybridConceptSearch({ ...defaultParams, extractedTerms: [] });
      expect(getConceptsForQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          documentIds: defaultParams.documentIds,
          accessibleDocIds: defaultParams.accessibleDocIds,
        }),
      );
    });
  });
});
