import { logger } from '@/server/logger';
import { getGraphDatabaseSource } from '@/features/graph-database';
import { DocumentNode } from '@/features/graph-database/types';
import { retryWithBackoff } from '@/features/graph-database/utils/retryWithBackoff';
import { embedContent } from '@/features/shared/dal/document-library/upload/embedContent';
import db from '@/server/db';
import { Prisma } from '@prisma/client';

/**
 * Graph Builder Service
 * Constructs the Neo4j graph from document chunks and their extracted entities
 */

/**
 * Create graph entity embedding record in PostgreSQL using raw SQL
 * Uses raw SQL because Prisma doesn't support CRUD operations on Unsupported("vector") types
 */
export async function createGraphEntityEmbedding(data: {
  id: string;
  entityName: string;
  embedding: number[];
  description: string;
  aliases: string[];
  documentId: string;
  userId: string;
  type: string | null;
  normalizedName: string | null;
}): Promise<void> {
  try {

    const vectorString = `[${data.embedding.join(',')}]`;

    // Use raw SQL to insert because vector type requires ::vector cast
    await db.$executeRaw(
      Prisma.sql`
        INSERT INTO "graph_entity_embeddings" ("id", "entityName", "embedding", "description", "aliases", "documentId", "userId", "type", "normalizedName")
        VALUES (${data.id}::uuid, ${data.entityName}, ${vectorString}::vector, ${data.description}, ${data.aliases}, ${data.documentId}::uuid, ${data.userId}::uuid, ${data.type}, ${data.normalizedName})
      `
    );

    logger.debug('Created graph entity embedding', { entityId: data.id, entityName: data.entityName });
  } catch (error) {
    logger.error('Error creating graph entity embedding:', error);
    throw error;
  }
}

/**
 * Create graph concept embedding record in PostgreSQL using raw SQL
 * Uses raw SQL because Prisma doesn't support CRUD operations on Unsupported("vector") types
 */
export async function createGraphConceptEmbedding(data: {
  id: string;
  conceptName: string;
  embedding: number[];
  description: string;
  category: string;
  documentId: string;
  userId: string;
  normalizedName: string | null;
}): Promise<void> {
  try {

    const vectorString = `[${data.embedding.join(',')}]`;

    // Use raw SQL to insert because vector type requires ::vector cast
    await db.$executeRaw(
      Prisma.sql`
        INSERT INTO "graph_concept_embeddings" ("id", "conceptName", "embedding", "description", "category", "documentId", "userId", "normalizedName")
        VALUES (${data.id}::uuid, ${data.conceptName}, ${vectorString}::vector, ${data.description}, ${data.category}, ${data.documentId}::uuid, ${data.userId}::uuid, ${data.normalizedName})
      `
    );

    logger.debug('Created graph concept embedding', { conceptId: data.id, conceptName: data.conceptName });
  } catch (error) {
    logger.error('Error creating graph concept embedding:', error);
    throw error;
  }
}

/**
 * Create a document node in the graph
 */
export async function createDocumentNode(document: DocumentNode): Promise<void> {
  const graphDb = await getGraphDatabaseSource();

  const query = `
    MERGE (d:Document {id: $id})
    SET d.filename = $filename,
        d.name = $filename,
        d.uploadStatus = $uploadStatus,
        d.createdAt = datetime($createdAt),
        d.userId = $userId,
        d.documentUploadProviderId = $documentUploadProviderId,
        d.totalChunks = $totalChunks,
        d.totalTokens = $totalTokens
    RETURN d
  `;

  try {
    await graphDb.run(query, {
      id: document.id,
      filename: document.filename,
      uploadStatus: document.uploadStatus,
      createdAt: document.createdAt.toISOString(),
      userId: document.userId,
      documentUploadProviderId: document.documentUploadProviderId,
      totalChunks: document.totalChunks,
      totalTokens: document.totalTokens,
    });

    logger.info(`Created document node: ${document.id}`);
  } catch (error) {
    logger.error(`Error creating document node ${document.id}:`, error);
    throw error;
  }
}

/**
 * Create SIMILAR_TO relationships between chunks based on embedding similarity
 */
export async function createSimilarityRelationships(
  chunkId: string,
  similarChunks: Array<{ id: string; score: number }>
): Promise<void> {
  if (similarChunks.length === 0) {
    return;
  }

  const queries = similarChunks.map((similar) => ({
    query: `
      MATCH (c1:Chunk {id: $chunkId})
      MATCH (c2:Chunk {id: $similarChunkId})
      MERGE (c1)-[s:SIMILAR_TO]->(c2)
      SET s.score = $score
    `,
    parameters: {
      chunkId,
      similarChunkId: similar.id,
      score: similar.score,
    },
  }));

  try {
    const graphDb = await getGraphDatabaseSource();
    await graphDb.runTransaction(queries);
    logger.debug(`Created ${similarChunks.length} similarity relationships for chunk ${chunkId}`);
  } catch (error) {
    logger.error(`Error creating similarity relationships for chunk ${chunkId}:`, error);
  }
}

/**
 * Delete all graph data for a document
 */
export async function deleteDocumentGraph(documentId: string): Promise<void> {
  const graphDb = await getGraphDatabaseSource();

  const query = `
    MATCH (d:Document {id: $documentId})
    OPTIONAL MATCH (d)-[:CONTAINS]->(c:Chunk)
    DETACH DELETE d, c
  `;

  try {
    await graphDb.run(query, { documentId });
    logger.info(`Deleted graph data for document ${documentId}`);
  } catch (error) {
    logger.error(`Error deleting graph for document ${documentId}:`, error);
    throw error;
  }
}

/**
 * Generate embeddings for all entities/concepts in a document
 * This is called after all chunks have been processed to:
 * 1. Generate embeddings based on entity/concept descriptions
 * 2. Create PostgreSQL records for vector search
 */
export async function embedDocumentEntities(
  documentId: string,
  userId: string
): Promise<void> {
  const graphDb = await getGraphDatabaseSource();

  logger.info(`[GRAPH-EMBED] Starting embedding generation for document ${documentId}`);

  // Get all entities needing embedding
  const entityResult = await graphDb.run(
    `MATCH (e:Entity {documentId: $documentId})
     WHERE e.needsEmbedding = true
     RETURN e.id as id, e.name as name, e.type as type, e.normalizedName as normalizedName, e.description as description, e.aliases as aliases`,
    { documentId }
  );

  const entities = entityResult.records.map(r => ({
    id: r.get('id'),
    name: r.get('name'),
    type: r.get('type'),
    normalizedName: r.get('normalizedName') ?? null,
    description: r.get('description') || '',
    aliases: r.get('aliases') || [],
  }));

  logger.info(`[GRAPH-EMBED] Found ${entities.length} entities to process`);

  const EMBED_BATCH_SIZE = 50;

  if (entities.length > 0) {
    const totalBatches = Math.ceil(entities.length / EMBED_BATCH_SIZE);
    let entitySuccessCount = 0;
    let entityFailCount = 0;

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const start = batchIdx * EMBED_BATCH_SIZE;
      const batchEntities = entities.slice(start, start + EMBED_BATCH_SIZE);
      const batchTexts = batchEntities.map(e => `${e.name} - ${e.description}`);

      let batchEmbeddings: Array<{ embedding: number[] }> | undefined;
      try {
        const result = await retryWithBackoff(() => embedContent(batchTexts, userId));
        batchEmbeddings = result.embeddings;
      } catch (error) {
        entityFailCount += batchEntities.length;
        logger.warn(`[GRAPH-EMBED] Entity embedding batch ${batchIdx + 1}/${totalBatches} failed after retries, skipping ${batchEntities.length} entities`, {
          documentId,
          batchIndex: batchIdx,
          batchSize: batchEntities.length,
          error: (error as Error).message,
        });
        continue;
      }

      if (!batchEmbeddings || batchEmbeddings.length === 0) {
        entityFailCount += batchEntities.length;
        logger.warn(`[GRAPH-EMBED] Entity embedding batch ${batchIdx + 1}/${totalBatches} returned empty, skipping`);
        continue;
      }

      for (let i = 0; i < batchEntities.length; i++) {
        const entity = batchEntities[i];
        try {
          await createGraphEntityEmbedding({
            id: entity.id,
            entityName: entity.name,
            embedding: batchEmbeddings[i].embedding,
            description: entity.description,
            aliases: entity.aliases,
            documentId: documentId,
            userId,
            type: entity.type,
            normalizedName: entity.normalizedName,
          });

          await graphDb.run(
            `MATCH (e:Entity {id: $entityId})
             SET e.needsEmbedding = false`,
            { entityId: entity.id }
          );

          entitySuccessCount++;
          logger.debug(`[GRAPH-EMBED] Processed entity: ${entity.name}`);
        } catch (error) {
          entityFailCount++;
          logger.error(`[GRAPH-EMBED] Error processing entity ${entity.name}:`, error);
        }
      }

      logger.info(`[GRAPH-EMBED] Completed entity embedding batch ${batchIdx + 1}/${totalBatches} (${batchEntities.length} items)`);
    }

    logger.info(`[GRAPH-EMBED] Entity embedding complete: ${entitySuccessCount} succeeded, ${entityFailCount} failed out of ${entities.length}`);
  }

  // Get all concepts needing embedding
  const conceptResult = await graphDb.run(
    `MATCH (c:Concept {documentId: $documentId})
     WHERE c.needsEmbedding = true
     RETURN c.id as id, c.name as name, c.category as category, c.normalizedName as normalizedName, c.description as description`,
    { documentId }
  );

  const concepts = conceptResult.records.map(r => ({
    id: r.get('id'),
    name: r.get('name'),
    category: r.get('category'),
    normalizedName: r.get('normalizedName') ?? null,
    description: r.get('description') || '',
  }));

  logger.info(`[GRAPH-EMBED] Found ${concepts.length} concepts to process`);

  if (concepts.length > 0) {
    const totalConceptBatches = Math.ceil(concepts.length / EMBED_BATCH_SIZE);
    let conceptSuccessCount = 0;
    let conceptFailCount = 0;

    for (let batchIdx = 0; batchIdx < totalConceptBatches; batchIdx++) {
      const start = batchIdx * EMBED_BATCH_SIZE;
      const batchConcepts = concepts.slice(start, start + EMBED_BATCH_SIZE);
      const batchTexts = batchConcepts.map(c => `${c.name} - ${c.description}`);

      let batchEmbeddings: Array<{ embedding: number[] }> | undefined;
      try {
        const result = await retryWithBackoff(() => embedContent(batchTexts, userId));
        batchEmbeddings = result.embeddings;
      } catch (error) {
        conceptFailCount += batchConcepts.length;
        logger.warn(`[GRAPH-EMBED] Concept embedding batch ${batchIdx + 1}/${totalConceptBatches} failed after retries, skipping ${batchConcepts.length} concepts`, {
          documentId,
          batchIndex: batchIdx,
          batchSize: batchConcepts.length,
          error: (error as Error).message,
        });
        continue;
      }

      if (!batchEmbeddings || batchEmbeddings.length === 0) {
        conceptFailCount += batchConcepts.length;
        logger.warn(`[GRAPH-EMBED] Concept embedding batch ${batchIdx + 1}/${totalConceptBatches} returned empty, skipping`);
        continue;
      }

      for (let i = 0; i < batchConcepts.length; i++) {
        const concept = batchConcepts[i];
        try {
          await createGraphConceptEmbedding({
            id: concept.id,
            conceptName: concept.name,
            embedding: batchEmbeddings[i].embedding,
            description: concept.description,
            category: concept.category,
            documentId: documentId,
            userId,
            normalizedName: concept.normalizedName,
          });

          await graphDb.run(
            `MATCH (c:Concept {id: $conceptId})
             SET c.needsEmbedding = false`,
            { conceptId: concept.id }
          );

          conceptSuccessCount++;
          logger.debug(`[GRAPH-EMBED] Processed concept: ${concept.name}`);
        } catch (error) {
          conceptFailCount++;
          logger.error(`[GRAPH-EMBED] Error processing concept ${concept.name}:`, error);
        }
      }

      logger.info(`[GRAPH-EMBED] Completed concept embedding batch ${batchIdx + 1}/${totalConceptBatches} (${batchConcepts.length} items)`);
    }

    logger.info(`[GRAPH-EMBED] Concept embedding complete: ${conceptSuccessCount} succeeded, ${conceptFailCount} failed out of ${concepts.length}`);
  }

  logger.info(`[GRAPH-EMBED] Completed embedding for document ${documentId}: ${entities.length} entities, ${concepts.length} concepts`);
}
