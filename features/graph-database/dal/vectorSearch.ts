import { Prisma } from '@prisma/client';
import db from '@/server/db';
import { logger } from '@/server/logger';

export interface VectorSearchOptions {
  threshold: number;               // Min similarity (0.0-1.0)
  limit?: number;                  // Max results per query (optional - threshold is the filter)
  includeEmbedding?: boolean;      // Return embedding vectors (default: false)
  documentScope?: string;          // Filter by documentId (optional)
  userId: string;                  // REQUIRED: Filter by user for isolation
}

export interface SimilarEntity {
  id: string;
  entityName: string;
  description: string;
  aliases: string[];
  documentId: string;
  similarity: number;              // Cosine similarity (0.0-1.0)
  embedding?: number[];            // Only if includeEmbedding=true
}

export interface SimilarConcept {
  id: string;
  conceptName: string;
  description: string;
  category: string;
  documentId: string;
  similarity: number;              // Cosine similarity (0.0-1.0)
  embedding?: number[];            // Only if includeEmbedding=true
}

// Default limit for LATERAL queries - HNSW is most efficient with a limit
const DEFAULT_VECTOR_SEARCH_LIMIT = 100;

/**
 * Search for similar entities using pgvector <=> operator with LATERAL join
 *
 * CRITICAL: Uses LATERAL join pattern to enable HNSW index usage at scale.
 * CROSS JOIN pattern cannot use HNSW because PostgreSQL can't optimize when
 * the search vector comes from a join rather than a parameter.
 *
 * Query pattern:
 * 1. Get source entity row
 * 2. LATERAL subquery finds top N nearest neighbors (HNSW can optimize this)
 * 3. Filter by threshold after LATERAL (threshold applied to HNSW results)
 * 4. documentScope filter applied inside LATERAL for efficiency
 */
export async function searchSimilarEntities(
  entityId: string,
  options: VectorSearchOptions
): Promise<SimilarEntity[]> {
  const {
    threshold,
    limit = DEFAULT_VECTOR_SEARCH_LIMIT,
    includeEmbedding = false,
    documentScope,
    userId,
  } = options;

  try {
    // LATERAL join pattern enables HNSW index usage
    // The inner query finds nearest neighbors, outer query filters by threshold
    const query = Prisma.sql`
      SELECT neighbors.*
      FROM graph_entity_embeddings source,
      LATERAL (
        SELECT
          e.id,
          e."entityName",
          e.description,
          e.aliases,
          e."documentId",
          ${includeEmbedding ? Prisma.sql`e.embedding,` : Prisma.empty}
          1 - (e.embedding <=> source.embedding) as similarity
        FROM graph_entity_embeddings e
        WHERE e.id != source.id
          AND e."userId" = ${userId}::uuid
          ${documentScope ? Prisma.sql`AND e."documentId" = ${documentScope}::uuid` : Prisma.empty}
        ORDER BY e.embedding <=> source.embedding
        LIMIT ${limit}
      ) neighbors
      WHERE source.id = ${entityId}::uuid
        AND neighbors.similarity > ${threshold}
    `;

    const results = await db.$queryRaw<Array<{
      id: string;
      entityName: string;
      description: string;
      aliases: string[];
      documentId: string;
      embedding?: string;  // pgvector format string
      similarity: number;
    }>>(query);

    // Parse embedding if requested
    return results.map(r => ({
      id: r.id,
      entityName: r.entityName,
      description: r.description,
      aliases: r.aliases,
      documentId: r.documentId,
      similarity: r.similarity,
      embedding: includeEmbedding && r.embedding
        ? JSON.parse(r.embedding)
        : undefined,
    }));
  } catch (error) {
    logger.error('Vector search failed:', { entityId, options, error });
    throw new Error('Failed to search similar entities');
  }
}

/**
 * Search for similar concepts using pgvector <=> operator with LATERAL join
 *
 * CRITICAL: Uses LATERAL join pattern to enable HNSW index usage at scale.
 * Same pattern as searchSimilarEntities but for graph_concept_embeddings table.
 * F2.7: Concept Resolution
 */
export async function searchSimilarConcepts(
  conceptId: string,
  options: VectorSearchOptions
): Promise<SimilarConcept[]> {
  const {
    threshold,
    limit = DEFAULT_VECTOR_SEARCH_LIMIT,
    includeEmbedding = false,
    documentScope,
    userId,
  } = options;

  try {
    // LATERAL join pattern enables HNSW index usage
    // The inner query finds nearest neighbors, outer query filters by threshold
    const query = Prisma.sql`
      SELECT neighbors.*
      FROM graph_concept_embeddings source,
      LATERAL (
        SELECT
          c.id,
          c."conceptName",
          c.description,
          c.category,
          c."documentId",
          ${includeEmbedding ? Prisma.sql`c.embedding,` : Prisma.empty}
          1 - (c.embedding <=> source.embedding) as similarity
        FROM graph_concept_embeddings c
        WHERE c.id != source.id
          AND c."userId" = ${userId}::uuid
          ${documentScope ? Prisma.sql`AND c."documentId" = ${documentScope}::uuid` : Prisma.empty}
        ORDER BY c.embedding <=> source.embedding
        LIMIT ${limit}
      ) neighbors
      WHERE source.id = ${conceptId}::uuid
        AND neighbors.similarity > ${threshold}
    `;

    const results = await db.$queryRaw<Array<{
      id: string;
      conceptName: string;
      description: string;
      category: string;
      documentId: string;
      embedding?: string;  // pgvector format string
      similarity: number;
    }>>(query);

    // Parse embedding if requested
    return results.map(r => ({
      id: r.id,
      conceptName: r.conceptName,
      description: r.description,
      category: r.category,
      documentId: r.documentId,
      similarity: r.similarity,
      embedding: includeEmbedding && r.embedding
        ? JSON.parse(r.embedding)
        : undefined,
    }));
  } catch (error) {
    logger.error('Vector search failed:', { conceptId, options, error });
    throw new Error('Failed to search similar concepts');
  }
}

/**
 * Verify pgvector HNSW index exists and is being used
 * Run during initialization to fail fast if index missing
 */
export async function verifyVectorIndex(): Promise<boolean> {
  try {
    const result = await db.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'graph_entity_embeddings'
        AND (indexdef LIKE '%ivfflat%' OR indexdef LIKE '%hnsw%')
    `;

    const hasIndex = result.length > 0;

    if (!hasIndex) {
      logger.warn('No pgvector index found on graph_entity_embeddings.embedding');
    } else {
      logger.info(`Found pgvector index: ${result[0].indexname}`);
    }

    return hasIndex;
  } catch (error) {
    logger.error('Failed to verify vector index:', error);
    return false;
  }
}

/**
 * Get EXPLAIN plan for vector search (debugging)
 * Used to verify HNSW index usage with LATERAL pattern
 */
export async function explainVectorSearch(entityId: string): Promise<string> {
  try {
    const result = await db.$queryRaw<Array<{ 'QUERY PLAN': string }>>`
      EXPLAIN
      SELECT neighbors.*
      FROM graph_entity_embeddings source,
      LATERAL (
        SELECT e.id, 1 - (e.embedding <=> source.embedding) as similarity
        FROM graph_entity_embeddings e
        WHERE e.id != source.id
        ORDER BY e.embedding <=> source.embedding
        LIMIT 50
      ) neighbors
      WHERE source.id = ${entityId}::uuid
    `;

    const plan = result.map(r => r['QUERY PLAN']).join('\n');

    // Check if HNSW index is used (actual index name is entity_embeddings_hnsw_idx)
    const usesIndex = plan.includes('Index Scan using entity_embeddings_hnsw_idx');

    if (!usesIndex) {
      logger.warn('Vector search not using HNSW index! Query plan:', plan);
    } else {
      logger.info('Vector search using HNSW index');
    }

    return plan;
  } catch (error) {
    logger.error('Failed to explain vector search:', error);
    return 'Error getting query plan';
  }
}
