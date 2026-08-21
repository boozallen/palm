import logger from '@/server/logger';
import db from '@/server/db';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

export interface ConceptSearchResult {
  id: string;
  conceptName: string;
  description: string;
  category: string;
  documentId: string;
  score: number;
}

export interface GetConceptsForQueryParams {
  embeddedQuery: number[];
  documentIds: string[];
  accessibleDocIds: AccessibleDocIds;
  minThreshold?: number;
  matchCount?: number;
}

export default async function getConceptsForQuery({
  embeddedQuery,
  documentIds,
  accessibleDocIds,
  minThreshold = 0.35,  // 35% similarity threshold
  matchCount = 10,
}: GetConceptsForQueryParams): Promise<ConceptSearchResult[]> {
  if (!documentIds.length) {
    logger.info('[GRAPH-RAG] No document IDs provided for concept search, returning empty results');
    return [];
  }

  const vectorString = `[${embeddedQuery.join(',')}]`;
  const accessibleArray = Array.from(accessibleDocIds);

  try {
    logger.info(`[GRAPH-RAG] Searching concepts for query across ${documentIds.length} documents`);

    const results = await db.$queryRaw<ConceptSearchResult[]>`
      SELECT
        c.id,
        c."conceptName",
        c.description,
        c.category,
        c."documentId"::text as "documentId",
        (1 - (c.embedding <=> ${vectorString}::vector)) as score
      FROM graph_concept_embeddings c
      WHERE c."documentId" = ANY(${documentIds}::uuid[])
        AND c."documentId" = ANY(${accessibleArray}::uuid[])
        AND (1 - (c.embedding <=> ${vectorString}::vector)) > ${minThreshold}
      ORDER BY c.embedding <=> ${vectorString}::vector
      LIMIT ${matchCount}
    `;

    logger.info(`[GRAPH-RAG] Found ${results.length} relevant concepts`);

    // Debug: Log concept scores for visibility
    if (results.length > 0) {
      const scoreDebug = results.slice(0, 5).map(r => ({
        name: r.conceptName,
        score: r.score.toFixed(4),
        category: r.category,
      }));
      logger.info(`[GRAPH-RAG] Top concept scores: ${JSON.stringify(scoreDebug)}`);
    }

    return results;
  } catch (error) {
    logger.error('[GRAPH-RAG] Concept search failed:', error);
    return [];
  }
}
