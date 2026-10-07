import logger from '@/server/logger';
import db from '@/server/db';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

export interface EntitySearchResult {
  id: string;
  entityName: string;
  description: string;
  aliases: string[];
  documentId: string;
  score: number;
}

export interface GetEntitiesForQueryParams {
  embeddedQuery: number[];
  documentIds: string[];
  accessibleDocIds: AccessibleDocIds;
  minThreshold?: number;
  matchCount?: number;
}

export default async function getEntitiesForQuery({
  embeddedQuery,
  documentIds,
  accessibleDocIds,
  minThreshold = 0.35,  // 35% similarity threshold
  matchCount = 10,
}: GetEntitiesForQueryParams): Promise<EntitySearchResult[]> {
  if (!documentIds.length) {
    logger.info('[GRAPH-RAG] No document IDs provided for entity search, returning empty results');
    return [];
  }

  const vectorString = `[${embeddedQuery.join(',')}]`;
  const accessibleArray = Array.from(accessibleDocIds);

  try {
    logger.info(`[GRAPH-RAG] Searching entities for query across ${documentIds.length} documents`);

    const results = await db.$queryRaw<EntitySearchResult[]>`
      SELECT
        e.id,
        e."entityName",
        e.description,
        e.aliases,
        e."documentId"::text as "documentId",
        (1 - (e.embedding <=> ${vectorString}::vector)) as score
      FROM graph_entity_embeddings e
      WHERE e."documentId" = ANY(${documentIds}::uuid[])
        AND e."documentId" = ANY(${accessibleArray}::uuid[])
        AND (1 - (e.embedding <=> ${vectorString}::vector)) > ${minThreshold}
      ORDER BY e.embedding <=> ${vectorString}::vector
      LIMIT ${matchCount}
    `;

    logger.info(`[GRAPH-RAG] Found ${results.length} relevant entities`);

    // Debug: Log entity scores for visibility
    if (results.length > 0) {
      const scoreDebug = results.slice(0, 5).map(r => ({
        name: r.entityName,
        score: r.score.toFixed(4),
        descPreview: r.description?.substring(0, 50),
      }));
      logger.info(`[GRAPH-RAG] Top entity scores: ${JSON.stringify(scoreDebug)}`);
    }

    return results;
  } catch (error) {
    logger.error('[GRAPH-RAG] Entity search failed:', error);
    return [];
  }
}
