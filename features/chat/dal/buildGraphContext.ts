import { EntitySearchResult } from '@/features/chat/dal/getEntitiesForQuery';
import { ConceptSearchResult } from '@/features/chat/dal/getConceptsForQuery';
import { Citation } from '@/features/chat/types/message';
import {
  getOneHopExpansion,
  OneHopResult,
  ShortestPathResult,
} from '@/features/graph-database/services/graphQueries';
import logger from '@/server/logger';

export interface GraphContext {
  entities: EntitySearchResult[];
  concepts: ConceptSearchResult[];
  chunks: Citation[];
  oneHopResults: OneHopResult[];
  shortestPaths: ShortestPathResult[];
}

/**
 * Build graph context from entity and concept search results
 *
 * Performs one-hop expansion to find structurally connected neighbors,
 * scoped to the documents passed in (already authorized at the route boundary).
 */
export async function buildGraphContext(
  entities: EntitySearchResult[],
  concepts: ConceptSearchResult[],
  documentIds: string[],
  chunks: Citation[] = [],
  shortestPaths: ShortestPathResult[] = [],
): Promise<GraphContext> {
  // Edge case: No entities AND no concepts
  if (entities.length === 0 && concepts.length === 0) {
    logger.debug('[GRAPH-RAG] No entities or concepts found, returning empty graph context');
    return { entities: [], concepts: [], chunks, oneHopResults: [], shortestPaths: [] };
  }

  if (documentIds.length === 0) {
    logger.debug('[GRAPH-RAG] No documentIds for one-hop expansion');
    return { entities, concepts, chunks, oneHopResults: [], shortestPaths };
  }

  // One-hop expansion from entities and concepts
  const entityIds = entities.map((e) => e.id);
  const conceptIds = concepts.map((c) => c.id);
  let oneHopResults: OneHopResult[] = [];

  try {
    oneHopResults = await getOneHopExpansion(entityIds, conceptIds, documentIds);
  } catch (error) {
    // Edge case: Neo4j query fails - continue without one-hop results
    logger.warn('[GRAPH-RAG] Failed to get one-hop expansion, continuing without it', { error });
  }

  logger.info(
    `[GRAPH-RAG] Graph context built: ${entities.length} entity anchors, ` +
      `${concepts.length} concept anchors, ${chunks.length} chunk anchors, ` +
      `${oneHopResults.length} one-hop connections`
  );

  return { entities, concepts, chunks, oneHopResults, shortestPaths };
}
