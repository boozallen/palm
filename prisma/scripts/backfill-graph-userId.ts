/**
 * Backfill userId on existing Chunk, Entity and Concept nodes
 * Derives userId from documentId → Document.userId
 *
 * Usage:
 * docker exec -it frontend yarn ts-node -r tsconfig-paths/register prisma/scripts/backfill-graph-userId.ts
 */

import db from '@/server/db';
import { getGraphDatabaseSource } from '@/features/graph-database';

async function backfillGraphUserId() {
  console.log('[MIGRATION] Starting userId backfill for graph nodes');

  // Get all documents with their userIds
  const documents = await db.document.findMany({
    select: { id: true, userId: true },
  });

  const docToUser = new Map(documents.map((d) => [d.id, d.userId]));
  console.log(`[MIGRATION] Found ${documents.length} documents`);

  const graphDb = await getGraphDatabaseSource();

  // Backfill Chunks (via Document relationship)
  // Chunks may not have documentId property yet, so we traverse from Document
  const chunkResult = await graphDb.run(`
    MATCH (d:Document)-[:CONTAINS]->(c:Chunk)
    WHERE c.userId IS NULL
    RETURN c.id as id, d.id as documentId
  `);

  let chunkCount = 0;
  let chunkSkipped = 0;
  for (const record of chunkResult.records) {
    const chunkId = record.get('id');
    const documentId = record.get('documentId');
    const userId = docToUser.get(documentId);

    if (userId) {
      await graphDb.run(
        'MATCH (c:Chunk {id: $chunkId}) SET c.userId = $userId, c.documentId = $documentId',
        { chunkId, userId, documentId }
      );
      chunkCount++;
    } else {
      chunkSkipped++;
    }
  }
  console.log(
    `[MIGRATION] Backfilled ${chunkCount} Chunk nodes (skipped ${chunkSkipped} with unknown documentId)`
  );

  // Backfill Entities
  const entityResult = await graphDb.run(`
    MATCH (e:Entity)
    WHERE e.userId IS NULL AND e.documentId IS NOT NULL
    RETURN e.id as id, e.documentId as documentId
  `);

  let entityCount = 0;
  let entitySkipped = 0;
  for (const record of entityResult.records) {
    const entityId = record.get('id');
    const documentId = record.get('documentId');
    const userId = docToUser.get(documentId);

    if (userId) {
      await graphDb.run('MATCH (e:Entity {id: $entityId}) SET e.userId = $userId', {
        entityId,
        userId,
      });
      entityCount++;
    } else {
      entitySkipped++;
    }
  }
  console.log(
    `[MIGRATION] Backfilled ${entityCount} Entity nodes (skipped ${entitySkipped} with unknown documentId)`
  );

  // Backfill Concepts
  const conceptResult = await graphDb.run(`
    MATCH (c:Concept)
    WHERE c.userId IS NULL AND c.documentId IS NOT NULL
    RETURN c.id as id, c.documentId as documentId
  `);

  let conceptCount = 0;
  let conceptSkipped = 0;
  for (const record of conceptResult.records) {
    const conceptId = record.get('id');
    const documentId = record.get('documentId');
    const userId = docToUser.get(documentId);

    if (userId) {
      await graphDb.run('MATCH (c:Concept {id: $conceptId}) SET c.userId = $userId', {
        conceptId,
        userId,
      });
      conceptCount++;
    } else {
      conceptSkipped++;
    }
  }
  console.log(
    `[MIGRATION] Backfilled ${conceptCount} Concept nodes (skipped ${conceptSkipped} with unknown documentId)`
  );

  // Verify all nodes have userId
  const chunkVerify = await graphDb.run(
    'MATCH (c:Chunk) WHERE c.userId IS NULL RETURN count(c) as count'
  );
  const entityVerify = await graphDb.run(
    'MATCH (e:Entity) WHERE e.userId IS NULL RETURN count(e) as count'
  );
  const conceptVerify = await graphDb.run(
    'MATCH (c:Concept) WHERE c.userId IS NULL RETURN count(c) as count'
  );

  const remainingChunks = chunkVerify.records[0]?.get('count') ?? 0;
  const remainingEntities = entityVerify.records[0]?.get('count') ?? 0;
  const remainingConcepts = conceptVerify.records[0]?.get('count') ?? 0;

  if (remainingChunks > 0 || remainingEntities > 0 || remainingConcepts > 0) {
    console.warn(
      `[MIGRATION] WARNING: ${remainingChunks} chunks, ${remainingEntities} entities, and ${remainingConcepts} concepts still have NULL userId`
    );
  } else {
    console.log('[MIGRATION] SUCCESS: All Chunk, Entity, and Concept nodes have userId set');
  }

  console.log('[MIGRATION] userId backfill complete');

  // Disconnect
  await graphDb.disconnect();
}

backfillGraphUserId().catch((error) => {
  console.error('[MIGRATION] Backfill failed:', error);
  process.exit(1);
});
