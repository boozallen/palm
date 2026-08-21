import {
  writeChunkGraph,
  writeSkippedChunk,
  getExtractedChunkIds,
  isDocumentExtractionComplete,
  markDocumentExtractionComplete,
  isDocumentResolutionComplete,
  markDocumentResolutionComplete,
} from '@/features/graph-database/services/writeChunkGraph';
import { getGraphDatabaseSource } from '@/features/graph-database';
import type { ChunkAnalysis, ChunkNode, ExtractedEntity } from '@/features/graph-database/types';

// Mock the graph database source
jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));

// Mock extraction rules so dedup behavior is deterministic regardless of config defaults
jest.mock('@/features/graph-database/utils/signals', () => ({
  getExtractionRules: jest.fn(() => [
    { name: 'same_doc_same_name', enabled: true, phase: 'extraction' },
    { name: 'same_doc_alias_overlap', enabled: true, phase: 'extraction' },
  ]),
}));

// Mock logger
jest.mock('@/server/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockGetGraphDatabaseSource = getGraphDatabaseSource as jest.Mock;

// Build a GraphQueryResult-like record
const makeRecord = (data: Record<string, unknown>) => ({
  get: (key: string) => data[key],
  keys: Object.keys(data) as PropertyKey[],
  toObject: () => data,
});

const makeEntity = (overrides: Partial<ExtractedEntity> = {}): ExtractedEntity => ({
  text: 'Defense Health Agency',
  type: 'ORGANIZATION',
  positions: [0],
  confidence: 0.9,
  description: 'A U.S. military healthcare organization',
  aliases: ['DHA'],
  context: 'The DHA oversees military health operations',
  ...overrides,
});

const makeAnalysis = (overrides: Partial<ChunkAnalysis> = {}): ChunkAnalysis => ({
  chunkId: 'chunk-1',
  content: 'some content',
  entities: [],
  concepts: [],
  relationships: [],
  summary: 'a summary',
  documentId: 'doc-1',
  ...overrides,
});

const makeChunk = (overrides: Partial<ChunkNode> = {}): ChunkNode => ({
  id: 'chunk-1',
  content: 'some content',
  contentNum: 0,
  tokenCount: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  embeddingId: 'chunk-1',
  summary: 'a summary',
  startPosition: 0,
  endPosition: 10,
  ...overrides,
});

describe('writeChunkGraph', () => {
  let mockTx: {
    run: jest.Mock;
    commit: jest.Mock;
    rollback: jest.Mock;
  };
  let mockSession: {
    run: jest.Mock;
    beginTransaction: jest.Mock;
    close: jest.Mock;
  };
  let mockGraphDb: {
    run: jest.Mock;
    getSession: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockTx = {
      run: jest.fn().mockResolvedValue({ records: [] }),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    mockSession = {
      run: jest.fn().mockResolvedValue({ records: [] }),
      beginTransaction: jest.fn(() => mockTx),
      close: jest.fn().mockResolvedValue(undefined),
    };
    mockGraphDb = {
      run: jest.fn().mockResolvedValue({ records: [] }),
      getSession: jest.fn().mockResolvedValue(mockSession),
    };
    mockGetGraphDatabaseSource.mockResolvedValue(mockGraphDb);
  });

  const lastQuery = () => {
    const calls = mockTx.run.mock.calls;
    return calls[calls.length - 1][0] as string;
  };
  const queries = () => mockTx.run.mock.calls.map((c) => c[0] as string);

  describe('atomicity', () => {
    it('commits the transaction and the final tx.run sets c.extracted = true', async () => {
      await writeChunkGraph({
        documentId: 'doc-1',
        chunk: makeChunk(),
        prevChunkId: null,
        position: 0,
        analysis: makeAnalysis({ entities: [makeEntity()] }),
        userId: 'user-1',
      });

      expect(mockTx.commit).toHaveBeenCalledTimes(1);
      expect(mockTx.rollback).not.toHaveBeenCalled();
      expect(mockSession.close).toHaveBeenCalledTimes(1);

      // The checkpoint write is the very last query in the transaction
      expect(lastQuery()).toContain('SET c.extracted = true');
    });

    it('rolls back and does not commit when a write fails mid-chunk', async () => {
      // First query (chunk MERGE) succeeds, second query throws
      mockTx.run
        .mockResolvedValueOnce({ records: [] })
        .mockRejectedValueOnce(new Error('neo4j write failed'));

      await expect(
        writeChunkGraph({
          documentId: 'doc-1',
          chunk: makeChunk(),
          prevChunkId: null,
          position: 0,
          analysis: makeAnalysis({ entities: [makeEntity()] }),
          userId: 'user-1',
        })
      ).rejects.toThrow('neo4j write failed');

      expect(mockTx.rollback).toHaveBeenCalledTimes(1);
      expect(mockTx.commit).not.toHaveBeenCalled();
      expect(mockSession.close).toHaveBeenCalledTimes(1);
    });

    it('marks an empty-analysis chunk extracted=true (so it is never re-extracted)', async () => {
      // Tabular/empty chunk: no entities, concepts, or relationships
      await writeChunkGraph({
        documentId: 'doc-1',
        chunk: makeChunk(),
        prevChunkId: null,
        position: 0,
        analysis: makeAnalysis(),
        userId: 'user-1',
      });

      expect(mockTx.commit).toHaveBeenCalledTimes(1);
      expect(lastQuery()).toContain('SET c.extracted = true');
      // First query MERGEs the chunk with extracted = false before the final flip
      expect(queries()[0]).toContain('c.extracted = false');
    });
  });

  describe('chunk + structural edges', () => {
    it('creates the NEXT edge when a previous chunk id is provided', async () => {
      await writeChunkGraph({
        documentId: 'doc-1',
        chunk: makeChunk({ id: 'chunk-2' }),
        prevChunkId: 'chunk-1',
        position: 1,
        analysis: makeAnalysis({ chunkId: 'chunk-2' }),
        userId: 'user-1',
      });

      expect(queries().some((q) => q.includes('MERGE (prev)-[:NEXT'))).toBe(true);
    });

    it('does not create a NEXT edge for the first chunk (prevChunkId null)', async () => {
      await writeChunkGraph({
        documentId: 'doc-1',
        chunk: makeChunk(),
        prevChunkId: null,
        position: 0,
        analysis: makeAnalysis(),
        userId: 'user-1',
      });

      expect(queries().some((q) => q.includes('MERGE (prev)-[:NEXT'))).toBe(false);
    });
  });

  describe('entity dedup within the transaction', () => {
    it('issues the MENTIONS MERGE (not CREATE) when an existing entity id is returned', async () => {
      // Rule-1 exact-name MATCH returns an existing entity id
      mockTx.run.mockImplementation((query: string) => {
        if (query.includes('{normalizedName: $normalizedName, documentId: $documentId}')) {
          return Promise.resolve({ records: [makeRecord({ id: 'existing-entity-id' })] });
        }
        return Promise.resolve({ records: [] });
      });

      await writeChunkGraph({
        documentId: 'doc-1',
        chunk: makeChunk(),
        prevChunkId: null,
        position: 0,
        analysis: makeAnalysis({ entities: [makeEntity()] }),
        userId: 'user-1',
      });

      const allQueries = queries();
      // Merge branch: MENTIONS edge + mentionCount increment
      expect(allQueries.some((q) => q.includes('MERGE (c)-[m:MENTIONS]->(e)'))).toBe(true);
      expect(allQueries.some((q) => q.includes('e.mentionCount = e.mentionCount + 1'))).toBe(true);
      // No new Entity node created
      expect(allQueries.some((q) => q.includes('CREATE (e:Entity'))).toBe(false);
    });

    it('CREATEs a new Entity node when no existing match is found', async () => {
      // Default mock returns empty records → both dedup rules miss
      await writeChunkGraph({
        documentId: 'doc-1',
        chunk: makeChunk(),
        prevChunkId: null,
        position: 0,
        analysis: makeAnalysis({ entities: [makeEntity()] }),
        userId: 'user-1',
      });

      expect(queries().some((q) => q.includes('CREATE (e:Entity'))).toBe(true);
    });

    it('re-running the same entity uses dedup MATCH and avoids a duplicate CREATE', async () => {
      // Simulate first run: entity does not exist yet → CREATE
      await writeChunkGraph({
        documentId: 'doc-1',
        chunk: makeChunk(),
        prevChunkId: null,
        position: 0,
        analysis: makeAnalysis({ entities: [makeEntity()] }),
        userId: 'user-1',
      });
      expect(queries().some((q) => q.includes('CREATE (e:Entity'))).toBe(true);

      // Simulate second (resume) run: the entity now exists → dedup MATCH returns id → MERGE only
      jest.clearAllMocks();
      mockTx.run.mockImplementation((query: string) => {
        if (query.includes('{normalizedName: $normalizedName, documentId: $documentId}')) {
          return Promise.resolve({ records: [makeRecord({ id: 'existing-entity-id' })] });
        }
        return Promise.resolve({ records: [] });
      });

      await writeChunkGraph({
        documentId: 'doc-1',
        chunk: makeChunk(),
        prevChunkId: null,
        position: 0,
        analysis: makeAnalysis({ entities: [makeEntity()] }),
        userId: 'user-1',
      });

      expect(queries().some((q) => q.includes('CREATE (e:Entity'))).toBe(false);
      expect(queries().some((q) => q.includes('MERGE (c)-[m:MENTIONS]->(e)'))).toBe(true);
    });
  });

  describe('relationships', () => {
    it('MERGEs a RELATED edge after entities are created (read-your-writes ordering)', async () => {
      const analysis = makeAnalysis({
        entities: [
          makeEntity({ text: 'John Smith', type: 'PERSON', aliases: [] }),
          makeEntity({ text: 'Microsoft', type: 'ORGANIZATION', aliases: [] }),
        ],
        relationships: [
          {
            source: 'John Smith',
            target: 'Microsoft',
            relationType: 'WORKS_FOR',
            description: 'John Smith works for Microsoft',
            context: 'John Smith, an engineer at Microsoft',
            confidence: 0.9,
          },
        ],
      });

      await writeChunkGraph({
        documentId: 'doc-1',
        chunk: makeChunk(),
        prevChunkId: null,
        position: 0,
        analysis,
        userId: 'user-1',
      });

      const allQueries = queries();
      const firstEntityCreateIdx = allQueries.findIndex((q) => q.includes('CREATE (e:Entity'));
      const relatedMergeIdx = allQueries.findIndex((q) => q.includes('MERGE (source)-[r:RELATED'));

      expect(firstEntityCreateIdx).toBeGreaterThanOrEqual(0);
      expect(relatedMergeIdx).toBeGreaterThanOrEqual(0);
      // Entities must be created before the relationship that references them
      expect(relatedMergeIdx).toBeGreaterThan(firstEntityCreateIdx);
    });
  });

  describe('custom properties (CUSTOM_GRAPH_SCHEMA)', () => {
    it('writes custom entity props on CREATE via SET e += $customProps, stripping reserved keys', async () => {
      await writeChunkGraph({
        documentId: 'doc-1',
        chunk: makeChunk(),
        prevChunkId: null,
        position: 0,
        analysis: makeAnalysis({
          entities: [
            makeEntity({
              properties: { solicitationNumber: 'ABC-123', type: 'HIJACK', id: 'evil', documentId: 'evil-doc' },
            }),
          ],
        }),
        userId: 'user-1',
      });

      const createCall = mockTx.run.mock.calls.find(([q]) => (q as string).includes('CREATE (e:Entity'));
      expect(createCall?.[0]).toContain('SET e += $customProps');
      // Reserved infra keys (type, id, documentId) are stripped; the custom key survives.
      expect(createCall?.[1].customProps).toEqual({ solicitationNumber: 'ABC-123' });
    });

    it('passes an empty customProps map when an entity has no custom properties', async () => {
      await writeChunkGraph({
        documentId: 'doc-1',
        chunk: makeChunk(),
        prevChunkId: null,
        position: 0,
        analysis: makeAnalysis({ entities: [makeEntity()] }),
        userId: 'user-1',
      });

      const createCall = mockTx.run.mock.calls.find(([q]) => (q as string).includes('CREATE (e:Entity'));
      expect(createCall?.[1].customProps).toEqual({});
    });

    it('writes custom relationship props on CREATE via r += $customRelProps, stripping reserved edge keys', async () => {
      const analysis = makeAnalysis({
        entities: [
          makeEntity({ text: 'Acme', type: 'TeamingPartner', aliases: [] }),
          makeEntity({ text: 'Globex', type: 'TeamingPartner', aliases: [] }),
        ],
        relationships: [
          {
            source: 'Acme',
            target: 'Globex',
            relationType: 'TEAMS_WITH',
            description: 'Acme teams with Globex',
            context: 'Acme and Globex are teaming',
            confidence: 0.9,
            properties: { role: 'prime', workshare: 60, relationType: 'HACK', confidence: 0.1 },
          },
        ],
      });

      await writeChunkGraph({
        documentId: 'doc-1',
        chunk: makeChunk(),
        prevChunkId: null,
        position: 0,
        analysis,
        userId: 'user-1',
      });

      const relCall = mockTx.run.mock.calls.find(([q]) => (q as string).includes('MERGE (source)-[r:RELATED'));
      expect(relCall?.[0]).toContain('r += $customRelProps');
      // Reserved edge keys (relationType, confidence) are stripped; custom keys survive.
      expect(relCall?.[1].customRelProps).toEqual({ role: 'prime', workshare: 60 });
    });

    it('does not write custom props on entity re-mention (MERGE branch)', async () => {
      mockTx.run.mockImplementation((query: string) => {
        if (query.includes('{normalizedName: $normalizedName, documentId: $documentId}')) {
          return Promise.resolve({ records: [makeRecord({ id: 'existing-entity-id' })] });
        }
        return Promise.resolve({ records: [] });
      });

      await writeChunkGraph({
        documentId: 'doc-1',
        chunk: makeChunk(),
        prevChunkId: null,
        position: 0,
        analysis: makeAnalysis({ entities: [makeEntity({ properties: { solicitationNumber: 'ABC-123' } })] }),
        userId: 'user-1',
      });

      // No CREATE, and the MENTIONS MERGE branch carries no custom props.
      expect(queries().some((q) => q.includes('CREATE (e:Entity'))).toBe(false);
      const mergeCall = mockTx.run.mock.calls.find(([q]) => (q as string).includes('MERGE (c)-[m:MENTIONS]->(e)'));
      expect(mergeCall?.[0]).not.toContain('customProps');
      expect(mergeCall?.[1]).not.toHaveProperty('customProps');
    });
  });

  describe('writeSkippedChunk', () => {
    it('commits an entity-less marker with extracted + extractionSkipped = true', async () => {
      await writeSkippedChunk({
        documentId: 'doc-1',
        chunk: makeChunk(),
        prevChunkId: null,
        position: 0,
        userId: 'user-1',
        reason: 'extraction blew up',
      });

      expect(mockTx.commit).toHaveBeenCalledTimes(1);
      expect(mockTx.rollback).not.toHaveBeenCalled();
      expect(mockSession.close).toHaveBeenCalledTimes(1);

      const allQueries = queries();
      // The chunk MERGE flags the chunk as both checkpointed and skipped
      expect(allQueries[0]).toContain('c.extracted = true');
      expect(allQueries[0]).toContain('c.extractionSkipped = true');
      expect(allQueries[0]).toContain('c.skipReason = $reason');
      // No entity/concept/relationship writes
      expect(allQueries.some((q) => q.includes('CREATE (e:Entity'))).toBe(false);
      expect(allQueries.some((q) => q.includes('CREATE (concept:Concept'))).toBe(false);
      expect(allQueries.some((q) => q.includes('MERGE (source)-[r:RELATED'))).toBe(false);
    });

    it('passes the failure reason through as a query parameter', async () => {
      await writeSkippedChunk({
        documentId: 'doc-1',
        chunk: makeChunk(),
        prevChunkId: null,
        position: 0,
        userId: 'user-1',
        reason: 'LLM timeout',
      });

      const mergeCall = mockTx.run.mock.calls.find(([q]) =>
        (q as string).includes('c.extractionSkipped = true')
      );
      expect(mergeCall?.[1]).toEqual(expect.objectContaining({ reason: 'LLM timeout' }));
    });

    it('creates a NEXT edge when a previous chunk id is provided', async () => {
      await writeSkippedChunk({
        documentId: 'doc-1',
        chunk: makeChunk({ id: 'chunk-2' }),
        prevChunkId: 'chunk-1',
        position: 1,
        userId: 'user-1',
        reason: 'boom',
      });

      expect(queries().some((q) => q.includes('MERGE (prev)-[:NEXT'))).toBe(true);
    });

    it('does not create a NEXT edge for the first chunk (prevChunkId null)', async () => {
      await writeSkippedChunk({
        documentId: 'doc-1',
        chunk: makeChunk(),
        prevChunkId: null,
        position: 0,
        userId: 'user-1',
        reason: 'boom',
      });

      expect(queries().some((q) => q.includes('MERGE (prev)-[:NEXT'))).toBe(false);
    });

    it('rolls back and rethrows when the marker write fails', async () => {
      mockTx.run.mockRejectedValueOnce(new Error('neo4j write failed'));

      await expect(
        writeSkippedChunk({
          documentId: 'doc-1',
          chunk: makeChunk(),
          prevChunkId: null,
          position: 0,
          userId: 'user-1',
          reason: 'boom',
        })
      ).rejects.toThrow('neo4j write failed');

      expect(mockTx.rollback).toHaveBeenCalledTimes(1);
      expect(mockTx.commit).not.toHaveBeenCalled();
      expect(mockSession.close).toHaveBeenCalledTimes(1);
    });
  });
});

describe('resume helpers', () => {
  let mockGraphDb: { run: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGraphDb = { run: jest.fn().mockResolvedValue({ records: [] }) };
    mockGetGraphDatabaseSource.mockResolvedValue(mockGraphDb);
  });

  describe('getExtractedChunkIds', () => {
    it('returns a Set of chunk ids from the query records', async () => {
      mockGraphDb.run.mockResolvedValueOnce({
        records: [makeRecord({ id: 'chunk-1' }), makeRecord({ id: 'chunk-2' })],
      });

      const ids = await getExtractedChunkIds('doc-1');

      expect(ids).toBeInstanceOf(Set);
      expect(ids.has('chunk-1')).toBe(true);
      expect(ids.has('chunk-2')).toBe(true);
      expect(ids.size).toBe(2);
      expect(mockGraphDb.run.mock.calls[0][0]).toContain('WHERE c.extracted = true');
    });

    it('returns an empty Set when no chunks are extracted', async () => {
      mockGraphDb.run.mockResolvedValueOnce({ records: [] });
      const ids = await getExtractedChunkIds('doc-1');
      expect(ids.size).toBe(0);
    });
  });

  describe('isDocumentExtractionComplete', () => {
    it('returns false when the document node does not exist', async () => {
      mockGraphDb.run.mockResolvedValueOnce({ records: [] });
      expect(await isDocumentExtractionComplete('doc-1')).toBe(false);
    });

    it('returns false when extractionComplete is absent/false (coalesce default)', async () => {
      mockGraphDb.run.mockResolvedValueOnce({ records: [makeRecord({ done: false })] });
      expect(await isDocumentExtractionComplete('doc-1')).toBe(false);
    });

    it('returns true when extractionComplete is true', async () => {
      mockGraphDb.run.mockResolvedValueOnce({ records: [makeRecord({ done: true })] });
      expect(await isDocumentExtractionComplete('doc-1')).toBe(true);
    });
  });

  describe('markDocumentExtractionComplete', () => {
    it('issues a SET d.extractionComplete = true for the document', async () => {
      await markDocumentExtractionComplete('doc-1');
      expect(mockGraphDb.run).toHaveBeenCalledTimes(1);
      expect(mockGraphDb.run.mock.calls[0][0]).toContain('SET d.extractionComplete = true');
      expect(mockGraphDb.run.mock.calls[0][1]).toEqual({ documentId: 'doc-1' });
    });
  });

  describe('isDocumentResolutionComplete', () => {
    it('returns false when the document node does not exist', async () => {
      mockGraphDb.run.mockResolvedValueOnce({ records: [] });
      expect(await isDocumentResolutionComplete('doc-1')).toBe(false);
    });

    it('returns false when resolutionComplete is absent/false (coalesce default)', async () => {
      mockGraphDb.run.mockResolvedValueOnce({ records: [makeRecord({ done: false })] });
      expect(await isDocumentResolutionComplete('doc-1')).toBe(false);
    });

    it('returns true when resolutionComplete is true', async () => {
      mockGraphDb.run.mockResolvedValueOnce({ records: [makeRecord({ done: true })] });
      expect(await isDocumentResolutionComplete('doc-1')).toBe(true);
    });
  });

  describe('markDocumentResolutionComplete', () => {
    it('issues a SET d.resolutionComplete = true for the document', async () => {
      await markDocumentResolutionComplete('doc-1');
      expect(mockGraphDb.run).toHaveBeenCalledTimes(1);
      expect(mockGraphDb.run.mock.calls[0][0]).toContain('SET d.resolutionComplete = true');
      expect(mockGraphDb.run.mock.calls[0][1]).toEqual({ documentId: 'doc-1' });
    });
  });
});
