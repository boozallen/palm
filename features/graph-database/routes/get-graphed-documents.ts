import { z } from 'zod';

import { procedure } from '@/server/trpc';
import db from '@/server/db';
import { getGraphDatabaseSource } from '@/features/graph-database';

const outputSchema = z.object({
  documentIds: z.array(z.string().uuid()),
  ungraphableDocumentIds: z.array(z.string().uuid()),
  // documentId -> schemaKey of the schema that graphed it (omitted when unknown).
  documentSchemas: z.record(z.string()),
});

/**
 * Returns the list of document IDs that have been graphed for the current user.
 * - documentIds: documents that are part of a graph AND have actual entity mentions in Neo4j
 * - ungraphableDocumentIds: documents that are part of a graph but have NO entity mentions
 * - documentSchemas: per-document key of the extraction schema used (from the Document node)
 *
 * Includes admin-created documents that have been graphed by their owners, so that
 * group members can see and use graph-RAG on admin data sources.
 *
 * Uses Neo4j to check for actual Document->Chunk->Entity relationships to ensure
 * documents truly have extracted entities, with PostgreSQL fallback if Neo4j fails.
 */
export default procedure
  .output(outputSchema)
  .query(async ({ ctx }) => {
    // 1. User's own graphs
    // 'Cancelling' counts alongside 'Completed' so a previously-graphed
    // document's badge never flickers while a cancel is being rolled back.
    const completedGraphedDocs = await db.$queryRaw<{ documentId: string }[]>`
      SELECT DISTINCT unnest(gm."documentIds")::text as "documentId"
      FROM graph_metadata gm
      WHERE gm."userId" = ${ctx.userId}::uuid
      AND gm."status" IN ('Completed', 'Cancelling')
    `;

    const buildingGraphedDocs = await db.$queryRaw<{ documentId: string }[]>`
      SELECT DISTINCT unnest(gm."documentIds")::text as "documentId"
      FROM graph_metadata gm
      WHERE gm."userId" = ${ctx.userId}::uuid
      AND gm."status" = 'Building'
    `;

    // 2. Admin documents the current user has access to (owned by another user)
    const adminDocsForUser = await db.document.findMany({
      where: {
        adminCreated: true,
        accessUsers: { some: { id: ctx.userId } },
      },
      select: { id: true, userId: true },
    });

    // 3. Admin-owned graph metadata for those documents
    let adminCompletedDocs: { documentId: string }[] = [];
    let adminBuildingDocs: { documentId: string }[] = [];

    if (adminDocsForUser.length > 0) {
      const adminOwnerIds = [...new Set(adminDocsForUser.map(d => d.userId))];
      const adminDocIds = adminDocsForUser.map(d => d.id);

      adminCompletedDocs = await db.$queryRaw<{ documentId: string }[]>`
        SELECT DISTINCT doc_id::text as "documentId"
        FROM (
          SELECT unnest(gm."documentIds") as doc_id
          FROM graph_metadata gm
          WHERE gm."userId" = ANY(${adminOwnerIds}::uuid[])
          AND gm."status" IN ('Completed', 'Cancelling')
        ) sub
        WHERE doc_id = ANY(${adminDocIds}::uuid[])
      `;

      adminBuildingDocs = await db.$queryRaw<{ documentId: string }[]>`
        SELECT DISTINCT doc_id::text as "documentId"
        FROM (
          SELECT unnest(gm."documentIds") as doc_id
          FROM graph_metadata gm
          WHERE gm."userId" = ANY(${adminOwnerIds}::uuid[])
          AND gm."status" = 'Building'
        ) sub
        WHERE doc_id = ANY(${adminDocIds}::uuid[])
      `;
    }

    const allGraphedDocs = [
      ...completedGraphedDocs,
      ...buildingGraphedDocs,
      ...adminCompletedDocs,
      ...adminBuildingDocs,
    ];

    // 4. Query Neo4j for documents with actual entity mentions (and their schema key)
    const graphDb = await getGraphDatabaseSource();

    let docsWithEntities: { documentId: string; schemaKey: string | null }[] = [];
    try {
      // User's own documents
      const ownResult = await graphDb.run(
        `MATCH (d:Document {userId: $userId})-[:CONTAINS]->(:Chunk)-[:MENTIONS]->(:Entity)
         RETURN DISTINCT d.id as documentId, d.schemaKey as schemaKey
         UNION
         MATCH (d:Document {userId: $userId})-[:MENTIONS]->(:Entity)
         RETURN DISTINCT d.id as documentId, d.schemaKey as schemaKey`,
        { userId: ctx.userId }
      );
      docsWithEntities = ownResult.records.map(record => ({
        documentId: record.get('documentId') as string,
        schemaKey: (record.get('schemaKey') as string | null) ?? null,
      }));

      // Admin documents — query using each admin owner's userId, scoped to their doc IDs
      if (adminDocsForUser.length > 0) {
        const adminOwnerIds = [...new Set(adminDocsForUser.map(d => d.userId))];
        const adminDocIds = adminDocsForUser.map(d => d.id);

        const adminResult = await graphDb.run(
          `MATCH (d:Document)-[:CONTAINS]->(:Chunk)-[:MENTIONS]->(:Entity)
           WHERE d.userId IN $ownerIds AND d.id IN $docIds
           RETURN DISTINCT d.id as documentId, d.schemaKey as schemaKey
           UNION
           MATCH (d:Document)-[:MENTIONS]->(:Entity)
           WHERE d.userId IN $ownerIds AND d.id IN $docIds
           RETURN DISTINCT d.id as documentId, d.schemaKey as schemaKey`,
          { ownerIds: adminOwnerIds, docIds: adminDocIds }
        );

        const adminDocsWithEntities = adminResult.records.map(record => ({
          documentId: record.get('documentId') as string,
          schemaKey: (record.get('schemaKey') as string | null) ?? null,
        }));
        docsWithEntities = [...docsWithEntities, ...adminDocsWithEntities];
      }
    } catch (error) {
      ctx.logger.warn('[GET-GRAPHED-DOCS] Neo4j query failed, falling back to PostgreSQL', error);

      const ownFallback = await db.$queryRaw<{ documentId: string }[]>`
        SELECT DISTINCT ee."documentId"::text as "documentId"
        FROM graph_entity_embeddings ee
        JOIN "Document" d ON ee."documentId" = d.id
        WHERE d."userId" = ${ctx.userId}::uuid
      `;
      docsWithEntities = ownFallback.map(r => ({ documentId: r.documentId, schemaKey: null }));

      if (adminDocsForUser.length > 0) {
        const adminOwnerIds = [...new Set(adminDocsForUser.map(d => d.userId))];
        const adminDocIds = adminDocsForUser.map(d => d.id);

        const adminFallback = await db.$queryRaw<{ documentId: string }[]>`
          SELECT DISTINCT ee."documentId"::text as "documentId"
          FROM graph_entity_embeddings ee
          JOIN "Document" d ON ee."documentId" = d.id
          WHERE d."userId" = ANY(${adminOwnerIds}::uuid[])
          AND ee."documentId" = ANY(${adminDocIds}::uuid[])
        `;
        docsWithEntities = [
          ...docsWithEntities,
          ...adminFallback.map(r => ({ documentId: r.documentId, schemaKey: null })),
        ];
      }
    }

    const completedSet = new Set([
      ...completedGraphedDocs.map(r => r.documentId),
      ...adminCompletedDocs.map(r => r.documentId),
    ]);
    const allGraphedSet = new Set(allGraphedDocs.map(r => r.documentId));
    const withEntitiesSet = new Set(docsWithEntities.map(r => r.documentId));

    // Documents with entities AND part of graph = graphed
    const documentIds = Array.from(withEntitiesSet)
      .filter(id => allGraphedSet.has(id));

    // Documents in COMPLETED graph but no entities = ungraphable
    const ungraphableDocumentIds = Array.from(completedSet)
      .filter(id => !withEntitiesSet.has(id));

    // Schema key per graphed document (only those that show as graphed and have a known key)
    const graphedSet = new Set(documentIds);
    const documentSchemas: Record<string, string> = {};
    for (const r of docsWithEntities) {
      if (r.schemaKey && graphedSet.has(r.documentId)) {
        documentSchemas[r.documentId] = r.schemaKey;
      }
    }

    return {
      documentIds,
      ungraphableDocumentIds,
      documentSchemas,
    };
  });
