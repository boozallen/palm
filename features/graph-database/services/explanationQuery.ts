import { ProcessDocumentsResult } from '@/features/chat/utils/chatContextHelpers';
import { embedContent } from '@/features/shared/dal/document-library/upload/embedContent';
import getEmbeddingsForDocuments from '@/features/chat/dal/getEmbeddingsForDocuments';
import { EntitySearchResult } from '@/features/chat/dal/getEntitiesForQuery';
import { ConceptSearchResult } from '@/features/chat/dal/getConceptsForQuery';
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
import { getGraphDatabaseSource } from '@/features/graph-database';
import db from '@/server/db';
import { logger } from '@/server/logger';

const ENTITY_ANCHOR_LIMIT = 10;
const CONCEPT_ANCHOR_LIMIT = 10;

/**
 * Execute an explanation query using semantic search + graph enhancement.
 *
 * Scoped mode (graphEntityIds present): fetches entities directly from pgvector
 * with similarity scoring, filters chunks to scoped entities.
 *
 * Unscoped mode: uses BM25 + vector + RRF fusion for anchor discovery,
 * then applies score-gap filtering to drop noise before 1-hop expansion.
 */
export async function explanationQuery({
  query,
  documentIds,
  userId,
  graphEntityIds,
}: {
  query: string;
  documentIds: string[];
  userId: string;
  graphEntityIds?: string[];
}): Promise<ProcessDocumentsResult> {
  logger.info('[EXPLANATION] Starting explanation query', {
    query: query.substring(0, 50),
    documentCount: documentIds.length,
    hybridEnabled: true,
    graphEntityIdCount: graphEntityIds?.length ?? 0,
  });

  // 1. Embed the query
  const embedded = await embedContent(query, userId);
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
  let citations = embeddingResult.map((context) => context.citation);

  // 3. Get entity/concept anchors
  try {
    let entities;
    let concepts;

    // Build AI source for hybrid search + anchor filter (shared)
    let aiSource: Awaited<ReturnType<AIFactory['buildKnowledgeGraphSource']>> | null = null;

    if (graphEntityIds?.length) {
      // SCOPED MODE: Fetch scoped entities/concepts with real embedding similarity scores.
      // Uses PostgreSQL pgvector so score-gap filtering works naturally —
      // entities semantically relevant to the question rank higher.
      const vectorString = `[${embeddedQuery.join(',')}]`;

      const [scopedEntities, scopedConcepts] = await Promise.all([
        db.$queryRaw<EntitySearchResult[]>`
          SELECT
            e.id,
            e."entityName",
            e.description,
            e.aliases,
            e."documentId"::text as "documentId",
            (1 - (e.embedding <=> ${vectorString}::vector)) as score
          FROM graph_entity_embeddings e
          WHERE e.id = ANY(${graphEntityIds}::uuid[])
          ORDER BY e.embedding <=> ${vectorString}::vector
        `,
        db.$queryRaw<ConceptSearchResult[]>`
          SELECT
            c.id,
            c."conceptName",
            c.description,
            c.category,
            c."documentId"::text as "documentId",
            (1 - (c.embedding <=> ${vectorString}::vector)) as score
          FROM graph_concept_embeddings c
          WHERE c.id = ANY(${graphEntityIds}::uuid[])
          ORDER BY c.embedding <=> ${vectorString}::vector
        `,
      ]);

      entities = scopedEntities;
      concepts = scopedConcepts;

      // Filter chunks to only those mentioned by scoped entities
      const graphDb = await getGraphDatabaseSource();
      const chunkResult = await graphDb.run(
        `MATCH (e:Entity)-[:MENTIONS|DISCUSSES]-(c:Chunk)
         WHERE e.id IN $ids
         RETURN DISTINCT c.embeddingId AS embeddingId`,
        { ids: graphEntityIds },
      );
      const scopedEmbeddingIds = new Set(
        chunkResult.records.map((r) => r.get('embeddingId')).filter(Boolean),
      );
      const chunksBefore = citations.length;
      citations = citations.filter(c => 'embeddingId' in c && scopedEmbeddingIds.has(c.embeddingId));

      logger.info('[EXPLANATION] Scoped mode — entities/concepts ranked by similarity', {
        entities: entities.length,
        concepts: concepts.length,
        chunksBefore,
        chunksAfter: citations.length,
        scopeSize: graphEntityIds.length,
        topEntities: entities.slice(0, 5).map(e => ({ name: e.entityName, score: e.score.toFixed(4) })),
      });

      // Build AI source for relevance filter
      const factory = new AIFactory({ userId });
      aiSource = await factory.buildKnowledgeGraphSource();
    } else {
      // UNSCOPED MODE: Hybrid search (BM25 + vector + RRF)
      const factory = new AIFactory({ userId });
      aiSource = await factory.buildKnowledgeGraphSource();
      const extractedTerms = (await extractSearchTerms(query, aiSource.source, aiSource.model)).terms;

      [entities, concepts] = await Promise.all([
        hybridEntitySearch({ extractedTerms, embeddedQuery, documentIds, accessibleDocIds, maxResults: ENTITY_ANCHOR_LIMIT }),
        hybridConceptSearch({ extractedTerms, embeddedQuery, documentIds, accessibleDocIds, maxResults: CONCEPT_ANCHOR_LIMIT }),
      ]);
    }

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
    let relevantEntities = filteredEntities;
    let relevantConcepts = filteredConcepts;
    let relevantChunks = citations;
    let pathResults: ShortestPathResult[] = [];

    if (aiSource) {
      const filtered = await filterAnchorsForRelevance(query, filteredEntities, filteredConcepts, aiSource.source, aiSource.model, citations);
      relevantEntities = filtered.entities;
      relevantConcepts = filtered.concepts;
      relevantChunks = filtered.chunks;

      logger.info('[EXPLANATION] LLM anchor filter', {
        entitiesBefore: filteredEntities.length,
        entitiesAfter: relevantEntities.length,
        conceptsBefore: filteredConcepts.length,
        conceptsAfter: relevantConcepts.length,
        chunksBefore: citations.length,
        chunksAfter: relevantChunks.length,
      });

      if (relevantEntities.length >= 2) {
        pathResults = await findShortestPaths(
          relevantEntities.map((e) => e.id),
          documentIds,
        );
        logger.info('[EXPLANATION] Shortest paths found', { count: pathResults.length });
      }
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
