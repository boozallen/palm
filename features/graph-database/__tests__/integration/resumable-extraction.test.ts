/** @jest-environment node */
/**
 * Integration test for resumable per-chunk graph extraction (live Neo4j).
 *
 * Drives the real extraction services (writeChunkGraph / writeSkippedChunk /
 * resume helpers) against a running Neo4j and asserts the resume invariants the
 * worker depends on:
 *   - committed chunks are NOT re-extracted on resume (skip set)
 *   - cross-chunk dedup is correct and mentionCount is NOT inflated by resume
 *   - the NEXT chain stays intact across the resume boundary
 *   - a skipped chunk is checkpointed as an entity-less, queryable marker
 *
 * Excluded from CI (jest config ignores __tests__/integration); run manually
 * (test path first so jest's variadic --testPathIgnorePatterns cannot swallow it):
 *   docker exec -e RUN_NEO4J_ITESTS=1 frontend yarn jest \
 *     features/graph-database/__tests__/integration/resumable-extraction.test.ts \
 *     --testPathIgnorePatterns '/node_modules/' '/palm-oss-damaris/' '/palm-oss-christie-graph/'
 */

import {
  writeChunkGraph,
  writeSkippedChunk,
  getExtractedChunkIds,
  isDocumentExtractionComplete,
  markDocumentExtractionComplete,
} from '@/features/graph-database/services/writeChunkGraph';
import { createDocumentNode } from '@/features/graph-database/services/graphBuilder';
import deleteGraphNodes from '@/features/graph-database/dal/deleteGraphNodes';
import { getGraphDatabaseSource } from '@/features/graph-database';
import type { ChunkAnalysis, ChunkNode, ExtractedEntity } from '@/features/graph-database/types';

// Deterministic dedup rules regardless of config drift; Neo4j stays REAL.
jest.mock('@/features/graph-database/utils/signals', () => ({
  ...jest.requireActual('@/features/graph-database/utils/signals'),
  getExtractionRules: jest.fn(() => [
    { name: 'same_doc_same_name', enabled: true, phase: 'extraction' },
    { name: 'same_doc_alias_overlap', enabled: true, phase: 'extraction' },
  ]),
}));

// Quiet the Winston logger during the test.
jest.mock('@/server/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const RUN = process.env.RUN_NEO4J_ITESTS === '1';
const describeIntegration = RUN ? describe : describe.skip;

const TEST_DOC_ID = 'itest-resume-doc';
const TEST_USER_ID = 'itest-user';

const entity = (overrides: Partial<ExtractedEntity> = {}): ExtractedEntity => ({
  text: 'Acme Corp',
  type: 'ORGANIZATION',
  positions: [0],
  confidence: 0.9,
  description: 'A company',
  aliases: [],
  context: 'Acme Corp does things',
  ...overrides,
});

const chunkNode = (id: string, contentNum: number): ChunkNode => ({
  id,
  content: `content ${id}`,
  contentNum,
  tokenCount: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  embeddingId: id,
  summary: '',
  startPosition: 0,
  endPosition: 10,
});

const analysisFor = (chunkId: string, entities: ExtractedEntity[]): ChunkAnalysis => ({
  chunkId,
  content: `content ${chunkId}`,
  entities,
  concepts: [],
  relationships: [],
  summary: `summary ${chunkId}`,
  documentId: TEST_DOC_ID,
});

describeIntegration('Resumable extraction (integration, live Neo4j)', () => {
  let graphDb: Awaited<ReturnType<typeof getGraphDatabaseSource>>;

  const countEntity = async (normalizedName: string): Promise<number> => {
    const r = await graphDb.run(
      'MATCH (e:Entity {documentId: $d, normalizedName: $n}) RETURN count(e) AS c',
      { d: TEST_DOC_ID, n: normalizedName }
    );
    return Number(r.records[0].get('c'));
  };

  const mentionCount = async (normalizedName: string): Promise<number> => {
    const r = await graphDb.run(
      'MATCH (e:Entity {documentId: $d, normalizedName: $n}) RETURN e.mentionCount AS m',
      { d: TEST_DOC_ID, n: normalizedName }
    );
    return r.records.length ? Number(r.records[0].get('m')) : 0;
  };

  const nextEdgeCount = async (): Promise<number> => {
    const r = await graphDb.run(
      'MATCH (:Chunk {documentId: $d})-[nx:NEXT]->(:Chunk) RETURN count(nx) AS c',
      { d: TEST_DOC_ID }
    );
    return Number(r.records[0].get('c'));
  };

  beforeAll(async () => {
    graphDb = await getGraphDatabaseSource();
    await graphDb.connect();
  });

  beforeEach(async () => {
    await deleteGraphNodes(TEST_DOC_ID);
    await createDocumentNode({
      id: TEST_DOC_ID,
      filename: 'itest.txt',
      uploadStatus: 'completed',
      createdAt: new Date(),
      userId: TEST_USER_ID,
      documentUploadProviderId: 'itest-provider',
      totalChunks: 4,
      totalTokens: 0,
    });
  });

  afterAll(async () => {
    await deleteGraphNodes(TEST_DOC_ID);
    await graphDb.disconnect();
  });

  it('resumes after a crash without re-extracting committed chunks or inflating mentionCount', async () => {
    const ids = ['c0', 'c1', 'c2', 'c3'];
    // "Acme Corp" is mentioned in c0, c1, c2 (shared entity); c3 has a different entity.
    const analyses: Record<string, ChunkAnalysis> = {
      c0: analysisFor('c0', [entity()]),
      c1: analysisFor('c1', [entity()]),
      c2: analysisFor('c2', [entity()]),
      c3: analysisFor('c3', [entity({ text: 'Globex', description: 'Another company' })]),
    };

    // --- Run 1: simulate a crash after committing only c0 and c1 ---
    let prev: string | null = null;
    for (const id of ['c0', 'c1']) {
      await writeChunkGraph({
        documentId: TEST_DOC_ID,
        chunk: chunkNode(id, ids.indexOf(id)),
        prevChunkId: prev,
        position: ids.indexOf(id),
        analysis: analyses[id],
        userId: TEST_USER_ID,
      });
      prev = id;
    }

    expect([...(await getExtractedChunkIds(TEST_DOC_ID))].sort()).toEqual(['c0', 'c1']);
    expect(await countEntity('acme corp')).toBe(1);
    expect(await mentionCount('acme corp')).toBe(2);
    expect(await isDocumentExtractionComplete(TEST_DOC_ID)).toBe(false);

    // --- Resume: replicate the worker loop's skip logic ---
    const extracted = await getExtractedChunkIds(TEST_DOC_ID);
    const writeSpy = jest.fn();
    prev = null;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (extracted.has(id)) {
        prev = id;
        continue; // committed in run 1 — must NOT re-extract or re-write
      }
      writeSpy(id);
      await writeChunkGraph({
        documentId: TEST_DOC_ID,
        chunk: chunkNode(id, i),
        prevChunkId: prev,
        position: i,
        analysis: analyses[id],
        userId: TEST_USER_ID,
      });
      prev = id;
    }
    await markDocumentExtractionComplete(TEST_DOC_ID);

    // Only c2 and c3 were written on resume; c0/c1 were skipped.
    expect(writeSpy.mock.calls.map((c) => c[0])).toEqual(['c2', 'c3']);

    // All four chunks are now checkpointed.
    expect([...(await getExtractedChunkIds(TEST_DOC_ID))].sort()).toEqual(['c0', 'c1', 'c2', 'c3']);
    // "Acme Corp" is still a single node with mentionCount 3 (c0,c1,c2) — NOT inflated by resume.
    expect(await countEntity('acme corp')).toBe(1);
    expect(await mentionCount('acme corp')).toBe(3);
    // NEXT chain spans all four chunks: c0->c1->c2->c3 (3 edges).
    expect(await nextEdgeCount()).toBe(3);
    expect(await isDocumentExtractionComplete(TEST_DOC_ID)).toBe(true);
  });

  it('records a skipped chunk as a checkpointed, entity-less marker that resume skips', async () => {
    await writeChunkGraph({
      documentId: TEST_DOC_ID,
      chunk: chunkNode('c0', 0),
      prevChunkId: null,
      position: 0,
      analysis: analysisFor('c0', [entity()]),
      userId: TEST_USER_ID,
    });
    await writeSkippedChunk({
      documentId: TEST_DOC_ID,
      chunk: chunkNode('c1', 1),
      prevChunkId: 'c0',
      position: 1,
      userId: TEST_USER_ID,
      reason: 'forced',
    });
    await writeChunkGraph({
      documentId: TEST_DOC_ID,
      chunk: chunkNode('c2', 2),
      prevChunkId: 'c1',
      position: 2,
      analysis: analysisFor('c2', [entity({ text: 'Globex' })]),
      userId: TEST_USER_ID,
    });

    // c1 is flagged + checkpointed, carries the reason, and has zero MENTIONS edges.
    const marker = await graphDb.run(
      `MATCH (c:Chunk {id: 'c1', documentId: $d})
       OPTIONAL MATCH (c)-[m:MENTIONS]->()
       RETURN c.extractionSkipped AS skipped, c.extracted AS extracted,
              c.skipReason AS reason, count(m) AS mentions`,
      { d: TEST_DOC_ID }
    );
    expect(marker.records[0].get('skipped')).toBe(true);
    expect(marker.records[0].get('extracted')).toBe(true);
    expect(marker.records[0].get('reason')).toBe('forced');
    expect(Number(marker.records[0].get('mentions'))).toBe(0);

    // Resume would skip c1 (it is in the extracted set); the NEXT chain c0->c1->c2 is intact.
    expect((await getExtractedChunkIds(TEST_DOC_ID)).has('c1')).toBe(true);
    expect(await nextEdgeCount()).toBe(2);
  });
});
