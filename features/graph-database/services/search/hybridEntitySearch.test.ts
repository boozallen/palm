import { hybridEntitySearch, HybridEntitySearchParams } from './hybridEntitySearch';
import { getGraphDatabaseSource } from '@/features/graph-database';
import getEntitiesForQuery from '@/features/chat/dal/getEntitiesForQuery';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn().mockResolvedValue({
    run: jest.fn().mockResolvedValue({ records: [] }),
  }),
}));

jest.mock('@/features/chat/dal/getEntitiesForQuery', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/server/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

const defaultParams: HybridEntitySearchParams = {
  extractedTerms: ['John Smith'],
  documentIds: ['doc-1'],
  accessibleDocIds: new Set(['doc-1']) as unknown as AccessibleDocIds,
  embeddedQuery: [0.1, 0.2],
  maxResults: 10,
};

describe('hybridEntitySearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({
      run: jest.fn().mockResolvedValue({ records: [] }),
    });
    (getEntitiesForQuery as jest.Mock).mockResolvedValue([]);
  });

  it('returns empty array when both legs return nothing', async () => {
    const result = await hybridEntitySearch(defaultParams);
    expect(result).toEqual([]);
  });

  it('returns vector-only results when BM25 returns nothing', async () => {
    (getEntitiesForQuery as jest.Mock).mockResolvedValue([
      { id: 'e1', entityName: 'Entity A', description: '', aliases: [], documentId: 'doc-1', score: 0.9 },
    ]);
    const result = await hybridEntitySearch(defaultParams);
    expect(result).toHaveLength(1);
    expect(result[0].entityName).toBe('Entity A');
  });

  it('merges BM25 and vector results with RRF', async () => {
    const mockRun = jest.fn().mockResolvedValue({
      records: [{
        get: (field: string) => ({
          id: 'bm25-only',
          name: 'BM25 Entity',
          description: '',
          aliases: [],
          documentId: 'doc-1',
        }[field]),
      }],
    });
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({ run: mockRun });
    (getEntitiesForQuery as jest.Mock).mockResolvedValue([
      { id: 'vector-only', entityName: 'Vector Entity', description: '', aliases: [], documentId: 'doc-1', score: 0.8 },
    ]);
    const result = await hybridEntitySearch(defaultParams);
    expect(result.length).toBeGreaterThan(0);
  });

  it('maps node.name to entityName for BM25 results', async () => {
    const mockRun = jest.fn().mockResolvedValue({
      records: [{
        get: (field: string) => ({
          id: 'bm25-e1',
          name: 'BM25 Name',
          description: 'desc',
          aliases: [],
          documentId: 'doc-1',
        }[field]),
      }],
    });
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({ run: mockRun });
    const result = await hybridEntitySearch(defaultParams);
    const bm25Result = result.find(r => r.id === 'bm25-e1');
    expect(bm25Result?.entityName).toBe('BM25 Name');
  });

  it('falls back to vector when BM25 throws', async () => {
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({
      run: jest.fn().mockRejectedValue(new Error('Neo4j down')),
    });
    (getEntitiesForQuery as jest.Mock).mockResolvedValue([
      { id: 'e1', entityName: 'Entity A', description: '', aliases: [], documentId: 'doc-1', score: 0.9 },
    ]);
    const result = await hybridEntitySearch(defaultParams);
    expect(result).toHaveLength(1);
    expect(result[0].entityName).toBe('Entity A');
  });

  it('uses vector-only when extractedTerms is empty', async () => {
    (getEntitiesForQuery as jest.Mock).mockResolvedValue([
      { id: 'e1', entityName: 'Entity A', description: '', aliases: [], documentId: 'doc-1', score: 0.9 },
    ]);
    const result = await hybridEntitySearch({ ...defaultParams, extractedTerms: [] });
    expect(result).toHaveLength(1);
    expect(getGraphDatabaseSource).not.toHaveBeenCalled();
  });

  it('respects maxResults cutoff', async () => {
    const manyEntities = Array.from({ length: 20 }, (_, i) => ({
      id: `e${i}`,
      entityName: `Entity ${i}`,
      description: '',
      aliases: [],
      documentId: 'doc-1',
      score: 0.5,
    }));
    (getEntitiesForQuery as jest.Mock).mockResolvedValue(manyEntities);
    const result = await hybridEntitySearch({ ...defaultParams, maxResults: 5 });
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('returns empty array when both legs fail', async () => {
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({
      run: jest.fn().mockRejectedValue(new Error('Neo4j down')),
    });
    (getEntitiesForQuery as jest.Mock).mockRejectedValue(new Error('pgvector down'));
    const result = await hybridEntitySearch(defaultParams);
    expect(result).toEqual([]);
  });

  // Tenancy: the scope arguments that drive document isolation must reach EVERY
  // retrieval leg — dropping one would leak cross-document entities to the agent.
  // True exclusion (real filtering) is proven in __tests__/integration (live DB);
  // here we assert the scope arguments are supplied (catches a dropped filter arg).
  describe('tenancy scoping', () => {
    it('passes $documentIds to every Neo4j leg (exact match + BM25)', async () => {
      const mockRun = jest.fn().mockResolvedValue({ records: [] });
      (getGraphDatabaseSource as jest.Mock).mockResolvedValue({ run: mockRun });
      await hybridEntitySearch(defaultParams);
      expect(mockRun).toHaveBeenCalled();
      for (const call of mockRun.mock.calls) {
        expect(call[1]).toEqual(expect.objectContaining({ documentIds: defaultParams.documentIds }));
      }
    });

    it('passes documentIds + accessibleDocIds to the pgvector leg', async () => {
      await hybridEntitySearch(defaultParams);
      expect(getEntitiesForQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          documentIds: defaultParams.documentIds,
          accessibleDocIds: defaultParams.accessibleDocIds,
        }),
      );
    });

    it('still scopes the vector-only fallback (no extracted terms) by documentIds + accessibleDocIds', async () => {
      await hybridEntitySearch({ ...defaultParams, extractedTerms: [] });
      expect(getEntitiesForQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          documentIds: defaultParams.documentIds,
          accessibleDocIds: defaultParams.accessibleDocIds,
        }),
      );
    });
  });
});
