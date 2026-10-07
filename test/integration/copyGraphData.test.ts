/**
 * @jest-environment node
 *
 * Integration tests for copyGraphData.
 *
 * Requires running Neo4j + Postgres locally (docker compose up -d).
 * If Neo4j isn't reachable, the suite is skipped.
 */

import db from '@/server/db';
import {
  GraphDatabaseFactory,
  _resetGraphDatabaseSourceForTesting,
} from '@/features/graph-database/factory';
import type { GraphDatabaseSource } from '@/features/graph-database/sources/types';
import copyGraphData from '@/features/shared/dal/document-library/upload/copyGraphData';
import {
  seedShareTestGraph,
  teardownShareTestGraph,
  type SeededIds,
} from './seedShareTestGraph';

const TEST_TIMEOUT = 60_000;

async function neo4jReachable(): Promise<{ source: GraphDatabaseSource | null; reachable: boolean }> {
  try {
    const factory = new GraphDatabaseFactory();
    const { source } = await factory.buildAndConnect();
    const ok = await source.healthCheck();
    if (!ok) {
      await source.disconnect();
      return { source: null, reachable: false };
    }
    return { source, reachable: true };
  } catch {
    return { source: null, reachable: false };
  }
}

async function countWhere(
  graphDb: GraphDatabaseSource,
  cypher: string,
  parameters: Record<string, unknown>
): Promise<number> {
  const result = await graphDb.run(cypher, parameters);
  if (result.records.length === 0) {
    return 0;
  }
  const value = result.records[0].get('count');
  if (typeof value === 'number') {
    return value;
  }
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value ?? 0);
}

describe('copyGraphData (integration)', () => {
  let graphDb: GraphDatabaseSource | null = null;
  let suiteEnabled = false;
  let ids: SeededIds | null = null;

  beforeAll(async () => {
    const probe = await neo4jReachable();
    suiteEnabled = probe.reachable;
    graphDb = probe.source;
    if (!suiteEnabled) {
      // eslint-disable-next-line no-console
      console.warn('[copyGraphData.integration] Neo4j unreachable, skipping suite');
    }
  }, TEST_TIMEOUT);

  afterEach(async () => {
    if (suiteEnabled && graphDb && ids) {
      await teardownShareTestGraph(graphDb, db, ids);
      ids = null;
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (graphDb) {
      await graphDb.disconnect();
    }
    _resetGraphDatabaseSourceForTesting();
  });

  function maybeIt(name: string, fn: () => Promise<void>, timeout = TEST_TIMEOUT) {
    return it(name, async () => {
      if (!suiteEnabled || !graphDb) {
        return;
      }
      await fn();
    }, timeout);
  }

  function freshSuffix(): string {
    return Math.random().toString(16).slice(2, 10).padEnd(8, '0');
  }

  async function ensureRecipientPostgresState(
    currentIds: SeededIds,
    sourceDocId: string,
    targetDocId: string
  ): Promise<void> {
    await db.$executeRawUnsafe(
      'INSERT INTO "Document" (id, "userId", filename, "uploadStatus", "createdAt", "documentUploadProviderId") '
      + `SELECT '${targetDocId}'::uuid, '${currentIds.userB}'::uuid, filename, "uploadStatus", NOW(), "documentUploadProviderId" `
      + `FROM "Document" WHERE id = '${sourceDocId}'::uuid `
      + 'ON CONFLICT DO NOTHING'
    );
    await db.$executeRawUnsafe(
      'INSERT INTO "Embedding" (id, embedding, content, "startPosition", "endPosition", "contentNum", "createdAt", "documentId") '
      + `SELECT gen_random_uuid(), embedding, content, "startPosition", "endPosition", "contentNum", NOW(), '${targetDocId}'::uuid `
      + `FROM "Embedding" WHERE "documentId" = '${sourceDocId}'::uuid`
    );
    await db.$executeRawUnsafe(
      'INSERT INTO graph_entity_embeddings (id, "entityName", embedding, description, aliases, "documentId", "userId", "createdAt") '
      + `SELECT gen_random_uuid(), "entityName", embedding, description, aliases, '${targetDocId}'::uuid, '${currentIds.userB}'::uuid, NOW() `
      + `FROM graph_entity_embeddings WHERE "documentId" = '${sourceDocId}'::uuid`
    );
    await db.$executeRawUnsafe(
      'INSERT INTO graph_concept_embeddings (id, "conceptName", embedding, description, category, "documentId", "userId", "createdAt") '
      + `SELECT gen_random_uuid(), "conceptName", embedding, description, category, '${targetDocId}'::uuid, '${currentIds.userB}'::uuid, NOW() `
      + `FROM graph_concept_embeddings WHERE "documentId" = '${sourceDocId}'::uuid`
    );
  }

  function targetDocId(_currentIds: SeededIds, suffix: string): string {
    return `00000000-0000-4000-8000-${suffix.padEnd(12, '0').slice(0, 12)}`;
  }

  maybeIt('completeness on PDF topology (docA1 → userB)', async () => {
    ids = await seedShareTestGraph(graphDb!, db, { runSuffix: freshSuffix() });
    const target = targetDocId(ids, '111111111111');
    await ensureRecipientPostgresState(ids, ids.docA1, target);

    const result = await copyGraphData({
      sourceDocumentId: ids.docA1,
      targetDocumentId: target,
      targetUserId: ids.userB,
    });
    expect(result).toBe(true);

    const doc = await countWhere(
      graphDb!,
      'MATCH (d:Document {id: $target, userId: $user}) RETURN count(d) AS count',
      { target, user: ids.userB }
    );
    expect(doc).toBe(1);

    const chunks = await countWhere(
      graphDb!,
      'MATCH (c:Chunk {documentId: $target, userId: $user}) RETURN count(c) AS count',
      { target, user: ids.userB }
    );
    expect(chunks).toBe(3);

    const entities = await countWhere(
      graphDb!,
      'MATCH (e:Entity {documentId: $target, userId: $user}) RETURN count(e) AS count',
      { target, user: ids.userB }
    );
    expect(entities).toBe(5);

    const concepts = await countWhere(
      graphDb!,
      'MATCH (c:Concept {documentId: $target, userId: $user}) RETURN count(c) AS count',
      { target, user: ids.userB }
    );
    expect(concepts).toBe(2);

    const contains = await countWhere(
      graphDb!,
      'MATCH (:Document {id: $target})-[r:CONTAINS]->(:Chunk) RETURN count(r) AS count',
      { target }
    );
    expect(contains).toBe(3);

    const next = await countWhere(
      graphDb!,
      'MATCH (:Chunk {documentId: $target})-[r:NEXT]->(:Chunk {documentId: $target}) RETURN count(r) AS count',
      { target }
    );
    expect(next).toBe(2);

    const mentions = await countWhere(
      graphDb!,
      'MATCH (:Chunk {documentId: $target})-[r:MENTIONS]->(:Entity {documentId: $target}) RETURN count(r) AS count',
      { target }
    );
    expect(mentions).toBe(6);

    const discusses = await countWhere(
      graphDb!,
      'MATCH (:Chunk {documentId: $target})-[r:DISCUSSES]->(:Concept {documentId: $target}) RETURN count(r) AS count',
      { target }
    );
    expect(discusses).toBe(3);

    const related = await countWhere(
      graphDb!,
      'MATCH ({documentId: $target})-[r:RELATED]->({documentId: $target}) RETURN count(r) AS count',
      { target }
    );
    expect(related).toBe(5);

    const worksFor = await countWhere(
      graphDb!,
      'MATCH ({documentId: $target})-[r:WORKS_FOR]->({documentId: $target}) RETURN count(r) AS count',
      { target }
    );
    expect(worksFor).toBe(1);

    const identity = await countWhere(
      graphDb!,
      'MATCH ({documentId: $target})-[r:IDENTITY]->({documentId: $target}) RETURN count(r) AS count',
      { target }
    );
    expect(identity).toBe(0);

    const sample = await graphDb!.run(
      'MATCH (e:Entity {documentId: $target, normalizedName: \'acme corp\'}) '
      + 'RETURN e.name AS name, e.type AS type, e.description AS description, e.aliases AS aliases, e.mentionCount AS mentionCount',
      { target }
    );
    expect(sample.records.length).toBe(1);
    expect(sample.records[0].get('name')).toBe('Acme Corp');
    expect(sample.records[0].get('type')).toBe('ORGANIZATION');
    expect(sample.records[0].get('description')).toBe('desc-0');
    expect(sample.records[0].get('aliases')).toEqual(['Acme', 'ACME Inc']);

    const leftoverMarkers = await countWhere(
      graphDb!,
      'MATCH (n {documentId: $target}) WHERE n._sourceId IS NOT NULL RETURN count(n) AS count',
      { target }
    );
    expect(leftoverMarkers).toBe(0);

    const pgEntities = await db.graphEntityEmbedding.findMany({
      where: { documentId: target },
      select: { id: true, entityName: true },
    });
    for (const pgEntity of pgEntities) {
      const lookup = await graphDb!.run(
        'MATCH (e:Entity {documentId: $target, normalizedName: $normalizedName}) RETURN e.id AS id',
        { target, normalizedName: pgEntity.entityName.toLowerCase() }
      );
      expect(lookup.records.length).toBe(1);
      expect(lookup.records[0].get('id')).toBe(pgEntity.id);
    }

    const recipientEmbeddingIds = await db.embedding.findMany({
      where: { documentId: target },
      select: { id: true },
    });
    const chunkEmbeddingIds = await graphDb!.run(
      'MATCH (c:Chunk {documentId: $target}) RETURN c.embeddingId AS embeddingId',
      { target }
    );
    const collected = chunkEmbeddingIds.records.map((r) => r.get('embeddingId') as string);
    const validIds = new Set(recipientEmbeddingIds.map((r) => r.id));
    for (const id of collected) {
      expect(validIds.has(id)).toBe(true);
    }
  });

  maybeIt('isolation: source user other docs do not leak', async () => {
    ids = await seedShareTestGraph(graphDb!, db, { runSuffix: freshSuffix() });
    const target = targetDocId(ids, '222222222222');
    await ensureRecipientPostgresState(ids, ids.docA1, target);

    await copyGraphData({
      sourceDocumentId: ids.docA1,
      targetDocumentId: target,
      targetUserId: ids.userB,
    });

    const leak = await countWhere(
      graphDb!,
      'MATCH (n) WHERE n.userId = $user AND coalesce(n.documentId, n.id) <> $target AND NOT (n:Document AND n.id = $target) RETURN count(n) AS count',
      { user: ids.userB, target }
    );
    expect(leak).toBe(0);
  });

  maybeIt('isolation: other user docs do not leak', async () => {
    ids = await seedShareTestGraph(graphDb!, db, { runSuffix: freshSuffix() });
    const target = targetDocId(ids, '333333333333');
    await ensureRecipientPostgresState(ids, ids.docA1, target);

    const userCBaseline = await countWhere(
      graphDb!,
      'MATCH (n) WHERE n.userId = $user RETURN count(n) AS count',
      { user: ids.userC }
    );

    await copyGraphData({
      sourceDocumentId: ids.docA1,
      targetDocumentId: target,
      targetUserId: ids.userB,
    });

    const userCAfter = await countWhere(
      graphDb!,
      'MATCH (n) WHERE n.userId = $user RETURN count(n) AS count',
      { user: ids.userC }
    );
    expect(userCAfter).toBe(userCBaseline);

    const userBOnDocC1 = await countWhere(
      graphDb!,
      'MATCH (n) WHERE n.userId = $user AND n.documentId = $docId RETURN count(n) AS count',
      { user: ids.userB, docId: ids.docC1 }
    );
    expect(userBOnDocC1).toBe(0);
  });

  maybeIt('cross-doc IDENTITY edge does NOT carry over', async () => {
    ids = await seedShareTestGraph(graphDb!, db, { runSuffix: freshSuffix() });
    const target = targetDocId(ids, '444444444444');
    await ensureRecipientPostgresState(ids, ids.docA1, target);

    await copyGraphData({
      sourceDocumentId: ids.docA1,
      targetDocumentId: target,
      targetUserId: ids.userB,
    });

    const idEdges = await countWhere(
      graphDb!,
      'MATCH ({documentId: $target})-[r:IDENTITY]-() RETURN count(r) AS count',
      { target }
    );
    expect(idEdges).toBe(0);

    const userBIdentity = await countWhere(
      graphDb!,
      'MATCH ()-[r:IDENTITY]-() WHERE r.userId = $user RETURN count(r) AS count',
      { user: ids.userB }
    );
    expect(userBIdentity).toBe(0);
  });

  maybeIt('intra-doc IDENTITY edge does NOT carry over (entities still copy)', async () => {
    ids = await seedShareTestGraph(graphDb!, db, { runSuffix: freshSuffix() });
    const target = targetDocId(ids, '555555555555');
    await ensureRecipientPostgresState(ids, ids.docA1, target);

    await copyGraphData({
      sourceDocumentId: ids.docA1,
      targetDocumentId: target,
      targetUserId: ids.userB,
    });

    const intraIdentity = await countWhere(
      graphDb!,
      'MATCH (a:Entity {documentId: $target})-[r:IDENTITY]->(b:Entity {documentId: $target}) RETURN count(r) AS count',
      { target }
    );
    expect(intraIdentity).toBe(0);

    const present = await graphDb!.run(
      'MATCH (e:Entity {documentId: $target}) WHERE e.normalizedName IN [\'acme corp\', \'nextgen tech\'] RETURN e.normalizedName AS normalizedName',
      { target }
    );
    const names = present.records.map((r) => r.get('normalizedName') as string).sort();
    expect(names).toEqual(['acme corp', 'nextgen tech']);
  });

  maybeIt('palm-graph topology completeness (docA3 → userB)', async () => {
    ids = await seedShareTestGraph(graphDb!, db, { runSuffix: freshSuffix() });
    const target = targetDocId(ids, '666666666666');
    await ensureRecipientPostgresState(ids, ids.docA3, target);

    const result = await copyGraphData({
      sourceDocumentId: ids.docA3,
      targetDocumentId: target,
      targetUserId: ids.userB,
    });
    expect(result).toBe(true);

    const doc = await countWhere(
      graphDb!,
      'MATCH (d:Document {id: $target, userId: $user}) RETURN count(d) AS count',
      { target, user: ids.userB }
    );
    expect(doc).toBe(1);

    const chunks = await countWhere(
      graphDb!,
      'MATCH (c:Chunk {documentId: $target}) RETURN count(c) AS count',
      { target }
    );
    expect(chunks).toBe(0);

    const entities = await countWhere(
      graphDb!,
      'MATCH (e:Entity {documentId: $target}) RETURN count(e) AS count',
      { target }
    );
    expect(entities).toBe(5);

    const concepts = await countWhere(
      graphDb!,
      'MATCH (c:Concept {documentId: $target}) RETURN count(c) AS count',
      { target }
    );
    expect(concepts).toBe(3);

    const docMentions = await countWhere(
      graphDb!,
      'MATCH (:Document {id: $target})-[r:MENTIONS]->(:Entity {documentId: $target}) RETURN count(r) AS count',
      { target }
    );
    expect(docMentions).toBe(5);

    const docDiscusses = await countWhere(
      graphDb!,
      'MATCH (:Document {id: $target})-[r:DISCUSSES]->(:Concept {documentId: $target}) RETURN count(r) AS count',
      { target }
    );
    expect(docDiscusses).toBe(3);

    const agencyFit = await countWhere(
      graphDb!,
      'MATCH ({documentId: $target})-[r:AGENCY_FIT]->({documentId: $target}) RETURN count(r) AS count',
      { target }
    );
    expect(agencyFit).toBe(2);

    const hasCapability = await countWhere(
      graphDb!,
      'MATCH ({documentId: $target})-[r:HAS_CAPABILITY]->({documentId: $target}) RETURN count(r) AS count',
      { target }
    );
    expect(hasCapability).toBe(2);

    const controlledBy = await countWhere(
      graphDb!,
      'MATCH ({documentId: $target})-[r:CONTROLLED_BY]->({documentId: $target}) RETURN count(r) AS count',
      { target }
    );
    expect(controlledBy).toBe(1);

    const gqResult = await graphDb!.run(
      'MATCH (d:Document {userId: $userId})-[:CONTAINS]->(:Chunk)-[:MENTIONS]->(:Entity) '
      + 'RETURN DISTINCT d.id AS documentId '
      + 'UNION '
      + 'MATCH (d:Document {userId: $userId})-[:MENTIONS]->(:Entity) '
      + 'RETURN DISTINCT d.id AS documentId',
      { userId: ids.userB }
    );
    const docsWithEntities = gqResult.records.map((r) => r.get('documentId') as string);
    expect(docsWithEntities).toContain(target);
  });

  maybeIt('returns false when source Document is missing', async () => {
    ids = await seedShareTestGraph(graphDb!, db, { runSuffix: freshSuffix() });
    const phantomSourceId = '00000000-0000-4000-8000-deadbeefdead';
    const target = targetDocId(ids, '777777777777');

    const result = await copyGraphData({
      sourceDocumentId: phantomSourceId,
      targetDocumentId: target,
      targetUserId: ids.userB,
    });
    expect(result).toBe(false);

    const targetCount = await countWhere(
      graphDb!,
      'MATCH (n {documentId: $target}) RETURN count(n) AS count',
      { target }
    );
    expect(targetCount).toBe(0);
  });

  maybeIt('returns false when source has Document but no non-Document nodes', async () => {
    ids = await seedShareTestGraph(graphDb!, db, { runSuffix: freshSuffix() });
    await graphDb!.run(
      'MATCH (n {documentId: $docId}) DETACH DELETE n',
      { docId: ids.docA1 }
    );

    const target = targetDocId(ids, '888888888888');
    const result = await copyGraphData({
      sourceDocumentId: ids.docA1,
      targetDocumentId: target,
      targetUserId: ids.userB,
    });
    expect(result).toBe(false);

    const created = await countWhere(
      graphDb!,
      'MATCH (n {documentId: $target}) RETURN count(n) AS count',
      { target }
    );
    expect(created).toBe(0);
  });

  maybeIt('multi-label node preserved across copy', async () => {
    ids = await seedShareTestGraph(graphDb!, db, { runSuffix: freshSuffix() });
    const target = targetDocId(ids, '999999999999');
    await ensureRecipientPostgresState(ids, ids.docA1, target);

    await copyGraphData({
      sourceDocumentId: ids.docA1,
      targetDocumentId: target,
      targetUserId: ids.userB,
    });

    const multi = await countWhere(
      graphDb!,
      'MATCH (e:Entity:Person {documentId: $target, normalizedName: \'carol multi\'}) RETURN count(e) AS count',
      { target }
    );
    expect(multi).toBe(1);
  });

  maybeIt('idempotency: re-running copy on same target throws clear error', async () => {
    ids = await seedShareTestGraph(graphDb!, db, { runSuffix: freshSuffix() });
    const target = targetDocId(ids, 'aaaaaaaaaaaa');
    await ensureRecipientPostgresState(ids, ids.docA1, target);

    await copyGraphData({
      sourceDocumentId: ids.docA1,
      targetDocumentId: target,
      targetUserId: ids.userB,
    });

    await expect(
      copyGraphData({
        sourceDocumentId: ids.docA1,
        targetDocumentId: target,
        targetUserId: ids.userB,
      })
    ).rejects.toThrow(/already has graph data/);
  });

  maybeIt('rejects Cypher reserved-word label and throws (sanitized)', async () => {
    ids = await seedShareTestGraph(graphDb!, db, { runSuffix: freshSuffix() });
    const target = targetDocId(ids, 'beadbeefcafe');
    await ensureRecipientPostgresState(ids, ids.docA1, target);

    // Inject a node labeled with a Cypher reserved word, scoped to docA1.
    // Backticks are required at injection because :MATCH would otherwise
    // parse as a clause keyword. labels(n) returns 'MATCH' verbatim, which
    // is what assertSafeLabel sees.
    await graphDb!.run(
      'CREATE (n:`MATCH` { id: $id, documentId: $docId, userId: $userId, name: \'reserved-test\' })',
      { id: 'reserved-label-test-id', docId: ids.docA1, userId: ids.userA }
    );

    await expect(
      copyGraphData({
        sourceDocumentId: ids.docA1,
        targetDocumentId: target,
        targetUserId: ids.userB,
      })
    ).rejects.toThrow(/Error copying graph data/);

    // Cleanup-on-failure removed the orphan target Document and any partial
    // node writes. Without this, the next retry would hit the idempotency
    // guard and the share would be permanently broken for this target.
    const targetDoc = await countWhere(
      graphDb!,
      'MATCH (d:Document {id: $target}) RETURN count(d) AS count',
      { target }
    );
    expect(targetDoc).toBe(0);
    const targetNonDocNodes = await countWhere(
      graphDb!,
      'MATCH (n {documentId: $target}) WHERE NOT n:Document RETURN count(n) AS count',
      { target }
    );
    expect(targetNonDocNodes).toBe(0);
  });

  maybeIt('rejects Cypher reserved-word relationship type and throws (sanitized)', async () => {
    ids = await seedShareTestGraph(graphDb!, db, { runSuffix: freshSuffix() });
    const target = targetDocId(ids, 'cafedeadbeef');
    await ensureRecipientPostgresState(ids, ids.docA1, target);

    // Link two existing fixture entities with a reserved-word edge type.
    await graphDb!.run(
      `MATCH (a:Entity {documentId: $docId, normalizedName: 'acme corp'})
       MATCH (b:Entity {documentId: $docId, normalizedName: 'bob smith'})
       CREATE (a)-[r:\`RETURN\` { documentId: $docId, userId: $userId }]->(b)`,
      { docId: ids.docA1, userId: ids.userA }
    );

    await expect(
      copyGraphData({
        sourceDocumentId: ids.docA1,
        targetDocumentId: target,
        targetUserId: ids.userB,
      })
    ).rejects.toThrow(/Error copying graph data/);

    const targetDoc = await countWhere(
      graphDb!,
      'MATCH (d:Document {id: $target}) RETURN count(d) AS count',
      { target }
    );
    expect(targetDoc).toBe(0);
  });

  maybeIt('retry succeeds after cleanup unblocks the partial-failure path', async () => {
    ids = await seedShareTestGraph(graphDb!, db, { runSuffix: freshSuffix() });
    const target = targetDocId(ids, 'feedfacefeed');
    await ensureRecipientPostgresState(ids, ids.docA1, target);

    // Inject a reserved-word label that will trigger a write-phase failure.
    await graphDb!.run(
      'CREATE (n:`MATCH` { id: $id, documentId: $docId, userId: $userId, name: \'recovery-test\' })',
      { id: 'recovery-test-orphan-id', docId: ids.docA1, userId: ids.userA }
    );

    await expect(
      copyGraphData({
        sourceDocumentId: ids.docA1,
        targetDocumentId: target,
        targetUserId: ids.userB,
      })
    ).rejects.toThrow(/Error copying graph data/);

    // Cleanup left no orphan Document, so the idempotency guard won't fire.
    // Now remove the bad-label node from the source and retry; the second
    // call should succeed because the partial state was cleared.
    await graphDb!.run(
      'MATCH (n:`MATCH` { id: $id }) DETACH DELETE n',
      { id: 'recovery-test-orphan-id' }
    );

    const result = await copyGraphData({
      sourceDocumentId: ids.docA1,
      targetDocumentId: target,
      targetUserId: ids.userB,
    });
    expect(result).toBe(true);

    const targetDoc = await countWhere(
      graphDb!,
      'MATCH (d:Document {id: $target, userId: $user}) RETURN count(d) AS count',
      { target, user: ids.userB }
    );
    expect(targetDoc).toBe(1);
  });

  maybeIt('MERGE write phase is retry-idempotent: re-running does not duplicate by (documentId, _sourceId)', async () => {
    // Defends against the regression that motivated this PR. Under BullMQ
    // retry, the write phase can hit the same target a second time with
    // _sourceId markers still present (e.g. previous attempt failed before
    // stripSourceIdMarker ran, and the smart-orphan cleanup didn't fully
    // empty the target — exactly the prod incident shape: 3× nodes per
    // _sourceId). With CREATE, the second pass produced N× parallel
    // duplicates. With MERGE keyed on (documentId, _sourceId), it's a no-op.
    //
    // We exercise this by re-running the production MERGE Cypher directly on
    // an already-populated target (with _sourceId markers re-added), since
    // going through copyGraphData a second time would route through
    // cleanupPartialTarget → deleteGraphNodes and erase the very state we
    // need to test the MERGE against.
    ids = await seedShareTestGraph(graphDb!, db, { runSuffix: freshSuffix() });
    const target = targetDocId(ids, 'beefcafef00d');
    await ensureRecipientPostgresState(ids, ids.docA3, target);

    // First copy lands cleanly via the public API.
    await copyGraphData({
      sourceDocumentId: ids.docA3,
      targetDocumentId: target,
      targetUserId: ids.userB,
    });

    const baseEntities = await countWhere(
      graphDb!,
      'MATCH (e:Entity {documentId: $target}) RETURN count(e) AS count',
      { target }
    );
    const baseConcepts = await countWhere(
      graphDb!,
      'MATCH (c:Concept {documentId: $target}) RETURN count(c) AS count',
      { target }
    );
    const baseDocMentions = await countWhere(
      graphDb!,
      'MATCH (:Document {id: $target})-[r:MENTIONS]->(:Entity {documentId: $target}) RETURN count(r) AS count',
      { target }
    );
    const baseDocDiscusses = await countWhere(
      graphDb!,
      'MATCH (:Document {id: $target})-[r:DISCUSSES]->(:Concept {documentId: $target}) RETURN count(r) AS count',
      { target }
    );
    const baseAgencyFit = await countWhere(
      graphDb!,
      'MATCH ({documentId: $target})-[r:AGENCY_FIT]->({documentId: $target}) RETURN count(r) AS count',
      { target }
    );

    // Re-add _sourceId markers via source→target cross-walk (markers were
    // stripped at end-of-copy by stripSourceIdMarker). Without this, the
    // MERGE keys can't find existing nodes and would CREATE — exactly what
    // we want to NOT happen.
    await graphDb!.run(
      `MATCH (s:Entity {documentId: $sourceDoc})
       MATCH (t:Entity {documentId: $targetDoc, normalizedName: s.normalizedName})
       SET t._sourceId = s.id`,
      { sourceDoc: ids.docA3, targetDoc: target }
    );
    await graphDb!.run(
      `MATCH (s:Concept {documentId: $sourceDoc})
       MATCH (t:Concept {documentId: $targetDoc, normalizedName: s.normalizedName})
       WHERE coalesce(t.category, '') = coalesce(s.category, '')
       SET t._sourceId = s.id`,
      { sourceDoc: ids.docA3, targetDoc: target }
    );

    // Read source state in the same shape copyGraphData's read layer would.
    const sourceNodesResult = await graphDb!.run(
      `MATCH (n {documentId: $sourceDoc}) WHERE NOT n:Document
       RETURN n.id AS sourceId, labels(n) AS labels, properties(n) AS props`,
      { sourceDoc: ids.docA3 }
    );
    const sourceInterEdgesResult = await graphDb!.run(
      `MATCH (a)-[r]->(b)
       WHERE a.documentId = $sourceDoc AND b.documentId = $sourceDoc
         AND NOT a:Document AND NOT b:Document AND type(r) <> 'IDENTITY'
       RETURN a.id AS sourceFromId, b.id AS sourceToId, type(r) AS relType, properties(r) AS props`,
      { sourceDoc: ids.docA3 }
    );
    const sourceDocOutResult = await graphDb!.run(
      `MATCH (d:Document {id: $sourceDoc})-[r]->(n)
       WHERE n.documentId = $sourceDoc AND NOT n:Document AND type(r) <> 'IDENTITY'
       RETURN n.id AS otherId, type(r) AS relType, properties(r) AS props`,
      { sourceDoc: ids.docA3 }
    );

    const RESERVED_NODE = new Set(['id', 'userId', 'documentId', '_sourceId']);
    const RESERVED_EDGE = new Set(['userId', 'documentId']);
    const stripProps = (props: Record<string, unknown>, reserved: Set<string>) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(props ?? {})) {
        if (reserved.has(k)) { continue; }
        out[k] = v;
      }
      return out;
    };

    // Bucket nodes by label-set (mirrors writeTargetNodes' bucketing).
    const byLabelKey = new Map<string, { labels: string[]; rows: Array<{ sourceId: string; props: Record<string, unknown> }> }>();
    for (const rec of sourceNodesResult.records) {
      const labels = rec.get('labels') as string[];
      const sid = rec.get('sourceId') as string;
      const props = stripProps(rec.get('props') as Record<string, unknown>, RESERVED_NODE);
      const key = labels.slice().sort().join(':');
      const existing = byLabelKey.get(key);
      if (existing) { existing.rows.push({ sourceId: sid, props }); }
      else { byLabelKey.set(key, { labels, rows: [{ sourceId: sid, props }] }); }
    }

    // Re-run production MERGE for non-Document nodes.
    for (const { labels, rows } of byLabelKey.values()) {
      const labelClause = labels.join(':');
      await graphDb!.run(
        `UNWIND $batch AS row
         MERGE (n:${labelClause} { documentId: $targetDocumentId, _sourceId: row.sourceId })
         ON CREATE SET
           n = row.props,
           n.id = randomUUID(),
           n.userId = $targetUserId,
           n.documentId = $targetDocumentId,
           n._sourceId = row.sourceId,
           n.createdAt = datetime()`,
        { batch: rows, targetUserId: ids.userB, targetDocumentId: target }
      );
    }

    // Re-run production MERGE for inter-node edges (bucketed by type).
    const interByType = new Map<string, Array<{ sourceFromId: string; sourceToId: string; props: Record<string, unknown> }>>();
    for (const rec of sourceInterEdgesResult.records) {
      const type = rec.get('relType') as string;
      const row = {
        sourceFromId: rec.get('sourceFromId') as string,
        sourceToId: rec.get('sourceToId') as string,
        props: stripProps(rec.get('props') as Record<string, unknown>, RESERVED_EDGE),
      };
      const arr = interByType.get(type);
      if (arr) { arr.push(row); }
      else { interByType.set(type, [row]); }
    }
    for (const [type, rows] of interByType.entries()) {
      await graphDb!.run(
        `UNWIND $batch AS row
         MATCH (a {documentId: $targetDocumentId, _sourceId: row.sourceFromId})
         MATCH (b {documentId: $targetDocumentId, _sourceId: row.sourceToId})
         MERGE (a)-[r:${type}]->(b)
         ON CREATE SET r = row.props, r.userId = $targetUserId, r.documentId = $targetDocumentId`,
        { batch: rows, targetDocumentId: target, targetUserId: ids.userB }
      );
    }

    // Re-run production MERGE for Document-anchored OUT edges (palm-graph
    // fixture has no IN doc-edges).
    const docOutByType = new Map<string, Array<{ sourceOtherId: string; props: Record<string, unknown> }>>();
    for (const rec of sourceDocOutResult.records) {
      const type = rec.get('relType') as string;
      const row = {
        sourceOtherId: rec.get('otherId') as string,
        props: stripProps(rec.get('props') as Record<string, unknown>, RESERVED_EDGE),
      };
      const arr = docOutByType.get(type);
      if (arr) { arr.push(row); }
      else { docOutByType.set(type, [row]); }
    }
    for (const [type, rows] of docOutByType.entries()) {
      await graphDb!.run(
        `UNWIND $batch AS row
         MATCH (d:Document {id: $targetDocumentId})
         MATCH (n {documentId: $targetDocumentId, _sourceId: row.sourceOtherId})
         MERGE (d)-[r:${type}]->(n)
         ON CREATE SET r = row.props, r.userId = $targetUserId, r.documentId = $targetDocumentId`,
        { batch: rows, targetDocumentId: target, targetUserId: ids.userB }
      );
    }

    // Counts must NOT have grown. With CREATE these would all double.
    const finalEntities = await countWhere(
      graphDb!,
      'MATCH (e:Entity {documentId: $target}) RETURN count(e) AS count',
      { target }
    );
    const finalConcepts = await countWhere(
      graphDb!,
      'MATCH (c:Concept {documentId: $target}) RETURN count(c) AS count',
      { target }
    );
    const finalDocMentions = await countWhere(
      graphDb!,
      'MATCH (:Document {id: $target})-[r:MENTIONS]->(:Entity {documentId: $target}) RETURN count(r) AS count',
      { target }
    );
    const finalDocDiscusses = await countWhere(
      graphDb!,
      'MATCH (:Document {id: $target})-[r:DISCUSSES]->(:Concept {documentId: $target}) RETURN count(r) AS count',
      { target }
    );
    const finalAgencyFit = await countWhere(
      graphDb!,
      'MATCH ({documentId: $target})-[r:AGENCY_FIT]->({documentId: $target}) RETURN count(r) AS count',
      { target }
    );

    expect(finalEntities).toBe(baseEntities);
    expect(finalConcepts).toBe(baseConcepts);
    expect(finalDocMentions).toBe(baseDocMentions);
    expect(finalDocDiscusses).toBe(baseDocDiscusses);
    expect(finalAgencyFit).toBe(baseAgencyFit);

    // Direct per-_sourceId duplication check (the prod-incident invariant).
    const perSourceDup = await countWhere(
      graphDb!,
      `MATCH (n {documentId: $target}) WHERE n._sourceId IS NOT NULL
       WITH n._sourceId AS sid, count(n) AS c
       WHERE c > 1
       RETURN count(*) AS count`,
      { target }
    );
    expect(perSourceDup).toBe(0);
  });

  maybeIt('recovers from stale orphan when previous attempt left an unmarked Document', async () => {
    // End-to-end: prove the smart idempotency guard recovers from the case
    // where post-failure cleanup ran but markCopyComplete never did. Simulate
    // by running a successful copy, then stripping the copyComplete flag —
    // that's exactly the state a previous attempt would leave behind if it
    // died after writeTargetDocument but before markCopyComplete.
    ids = await seedShareTestGraph(graphDb!, db, { runSuffix: freshSuffix() });
    const target = targetDocId(ids, 'deadbeefcafe');
    await ensureRecipientPostgresState(ids, ids.docA1, target);

    // First copy lands cleanly — copyComplete=true on target.
    const firstResult = await copyGraphData({
      sourceDocumentId: ids.docA1,
      targetDocumentId: target,
      targetUserId: ids.userB,
    });
    expect(firstResult).toBe(true);

    const flagBefore = await countWhere(
      graphDb!,
      'MATCH (d:Document {id: $target}) WHERE d.copyComplete = true RETURN count(d) AS count',
      { target }
    );
    expect(flagBefore).toBe(1);

    // Simulate "previous attempt died right before markCopyComplete":
    // strip the flag so the next copy sees a stale-orphan-shaped Document.
    await graphDb!.run(
      'MATCH (d:Document {id: $target}) REMOVE d.copyComplete',
      { target }
    );

    // Second copy should detect stale orphan, run cleanup via deleteGraphNodes,
    // then fully re-copy from source. No "already has graph data" error.
    const secondResult = await copyGraphData({
      sourceDocumentId: ids.docA1,
      targetDocumentId: target,
      targetUserId: ids.userB,
    });
    expect(secondResult).toBe(true);

    // Verify target ended up healthy: Document present, copyComplete set,
    // children copied through.
    const flagAfter = await countWhere(
      graphDb!,
      'MATCH (d:Document {id: $target}) WHERE d.copyComplete = true RETURN count(d) AS count',
      { target }
    );
    expect(flagAfter).toBe(1);

    const targetEntities = await countWhere(
      graphDb!,
      'MATCH (e:Entity {documentId: $target}) RETURN count(e) AS count',
      { target }
    );
    expect(targetEntities).toBeGreaterThan(0);
  });
});
