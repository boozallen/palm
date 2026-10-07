import { ProcessDocumentsResult } from '@/features/chat/utils/chatContextHelpers';
import { embedContent } from '@/features/shared/dal/document-library/upload/embedContent';
import getEmbeddingsForDocuments from '@/features/chat/dal/getEmbeddingsForDocuments';
import { buildGraphContext } from '@/features/chat/dal/buildGraphContext';
import getAccessibleDocumentIds from '@/features/shared/dal/getAccessibleDocumentIds';
import { AIFactory } from '@/features/ai-provider/factory';
import {
  extractSearchTerms,
  hybridEntitySearch,
  hybridConceptSearch,
  scoreGapFilter,
  filterAnchorsForRelevance,
} from '@/features/graph-database/services/search';
import { findShortestPaths, ShortestPathResult } from '@/features/graph-database/services/graphQueries';
import { logger } from '@/server/logger';

const ENTITY_ANCHOR_LIMIT = 10;
const CONCEPT_ANCHOR_LIMIT = 10;

/**
 * Execute an explanation query using semantic search + graph enhancement.
 *
 * Uses BM25 + vector + RRF fusion for anchor discovery,
 * then applies score-gap filtering to drop noise before 1-hop expansion.
 */
export async function explanationQuery({
  query,
  documentIds,
  userId,
  userGroupId,
}: {
  query: string;
  documentIds: string[];
  userId: string;
  userGroupId?: string;
}): Promise<ProcessDocumentsResult> {
  logger.info('[EXPLANATION] Starting explanation query', {
    query: query.substring(0, 50),
    documentCount: documentIds.length,
    hybridEnabled: true,
  });

  // 1. Embed the query
  const embedded = await embedContent(query, userId, undefined, undefined, userGroupId ?? undefined);
  if (!embedded.embeddings?.length) {
    return { citations: [] };
  }
  const embeddedQuery = embedded.embeddings[0].embedding;

  const accessibleDocIds = await getAccessibleDocumentIds(userId);

  // 2. Get chunk citations (vector search — unchanged)
  const embeddingResult = await getEmbeddingsForDocuments({
    userId,
    embeddedQuery,
    documentIds,
    accessibleDocIds,
    minThreshold: 0.35, // stricter threshold for graph mode
  });
  const citations = embeddingResult.map((context) => context.citation);

  // 3. Get entity/concept anchors
  try {
    const factory = new AIFactory({ userId, userGroupId });
    const aiSource = await factory.buildKnowledgeGraphSource();
    const extractedTerms = (await extractSearchTerms(query, aiSource.source, aiSource.model)).terms;

    const [entities, concepts] = await Promise.all([
      hybridEntitySearch({ extractedTerms, embeddedQuery, documentIds, accessibleDocIds, maxResults: ENTITY_ANCHOR_LIMIT }),
      hybridConceptSearch({ extractedTerms, embeddedQuery, documentIds, accessibleDocIds, maxResults: CONCEPT_ANCHOR_LIMIT }),
    ]);

    // 4. Score-gap filtering — drop noise anchors before 1-hop expansion
    const filteredEntities = scoreGapFilter(entities);
    const filteredConcepts = scoreGapFilter(concepts);

    logger.info('[EXPLANATION] Anchor filtering', {
      entitiesBefore: entities.length,
      entitiesAfter: filteredEntities.length,
      conceptsBefore: concepts.length,
      conceptsAfter: filteredConcepts.length,
    });

    // 5. LLM relevance filter + shortest path injection
    const filtered = await filterAnchorsForRelevance(query, filteredEntities, filteredConcepts, aiSource.source, aiSource.model, citations);
    const relevantEntities = filtered.entities;
    const relevantConcepts = filtered.concepts;
    const relevantChunks = filtered.chunks;

    logger.info('[EXPLANATION] LLM anchor filter', {
      entitiesBefore: filteredEntities.length,
      entitiesAfter: relevantEntities.length,
      conceptsBefore: filteredConcepts.length,
      conceptsAfter: relevantConcepts.length,
      chunksBefore: citations.length,
      chunksAfter: relevantChunks.length,
    });

    const pathResults: ShortestPathResult[] = relevantEntities.length >= 2
      ? await findShortestPaths(relevantEntities.map((e) => e.id), documentIds)
      : [];

    if (relevantEntities.length >= 2) {
      logger.info('[EXPLANATION] Shortest paths found', { count: pathResults.length });
    }

    // 6. Build graph context with filtered anchors + path results
    const graphContext = await buildGraphContext(
      relevantEntities,
      relevantConcepts,
      documentIds,
      relevantChunks,
      pathResults,
    );

    return { citations: relevantChunks, graphContext };
  } catch (error) {
    logger.warn('[EXPLANATION] Graph context build failed, returning citations only', { error });
    return { citations };
  }
}
