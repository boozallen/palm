import { logger } from '@/server/logger';
import { getGraphDatabaseSource } from '@/features/graph-database';
import { EntityType, ConceptCategory } from '@/features/graph-database/types';
import { expandIdentityClusters } from '@/features/graph-database/dal/expandIdentityClusters';
import { FORBIDDEN_REL_TYPES } from '@/features/graph-database/services/cypherUtils';

/**
 * Graph Query Service
 * Provides high-level query functions for the knowledge graph
 */

export interface EntityResult {
  id: string;
  name: string;
  type: EntityType;
  mentionCount: number;
  documents: Array<{ id: string; filename: string }>;
}

export interface ConceptResult {
  id: string;
  name: string;
  category: ConceptCategory;
  mentionCount: number;
  relatedConcepts: Array<{ name: string; strength: number }>;
}

export interface DocumentGraphSummary {
  documentId: string;
  filename: string;
  totalChunks: number;
  entities: Array<{ name: string; type: string; count: number }>;
  concepts: Array<{ name: string; count: number }>;
  topics: string[];
}

export interface EntityDetail {
  name: string;
  type: string;
  description: string;
  aliases: string[];
  mentionContext?: string;  // Context snippet where mentioned in this chunk
  mentionConfidence?: number;
}

export interface ConceptDetail {
  name: string;
  category: string;
  description: string;
  relevance?: number;
  sentiment?: string;
  discussionContext?: string;  // Context snippet for this discussion
}

export interface RelationshipDetail {
  source: string;
  target: string;
  type: string;
  description?: string;
  confidence?: number;
}

export interface OneHopResult {
  anchor: {
    id: string;
    name: string;
    type: 'ENTITY' | 'CONCEPT';
  };
  relationship: {
    type: string;
    description?: string;
    context?: string;      // Mention/discussion context from edge (for Chunk neighbors)
    confidence?: number;
    sourceName: string;
    targetName: string;
  };
  neighbor: {
    id: string;
    name?: string;         // Optional - Chunks don't have names
    description?: string;  // For Chunks, this is the summary
    type?: string;
  };
}

export interface ChunkContext {
  chunk: {
    id: string;
    content: string;
    contentNum: number;
  };
  previousChunk?: {
    id: string;
    content: string;
    contentNum: number;
  };
  nextChunk?: {
    id: string;
    content: string;
    contentNum: number;
  };
  entities: string[];           // Keep for backward compat (just names)
  entityDetails: EntityDetail[]; // Full entity properties with descriptions
  concepts: string[];           // Keep for backward compat (just names)
  conceptDetails: ConceptDetail[]; // Full concept properties with descriptions
  relationships: RelationshipDetail[]; // Relationships between entities in this chunk
  topics: string[];
}

const FORBIDDEN_REL_TYPES_CYPHER = FORBIDDEN_REL_TYPES.map(
  (relationshipType) => `'${relationshipType}'`,
).join(', ');

/**
 * Get all entities mentioned in a document
 */
export async function getDocumentEntities(documentId: string): Promise<EntityResult[]> {
  const query = `
    MATCH (d:Document {id: $documentId})-[:CONTAINS]->(c:Chunk)-[m:MENTIONS]->(e:Entity)
    WITH e, d, count(c) as chunkCount, sum(m.count) as totalMentions
    RETURN e.id as id, e.name as name, e.type as type, totalMentions as mentionCount,
           collect(DISTINCT {id: d.id, filename: d.filename}) as documents
    ORDER BY mentionCount DESC
  `;

  try {
    const graphDb = await getGraphDatabaseSource();
    const result = await graphDb.run(query, { documentId });
    return result.records.map((record) => ({
      id: record.get('id'),
      name: record.get('name'),
      type: record.get('type') as EntityType,
      mentionCount: record.get('mentionCount'),
      documents: record.get('documents'),
    }));
  } catch (error) {
    logger.error(`Error getting entities for document ${documentId}:`, error);
    return [];
  }
}

/**
 * Get all concepts discussed in a document
 */
export async function getDocumentConcepts(documentId: string): Promise<ConceptResult[]> {
  const query = `
    MATCH (d:Document {id: $documentId})-[:CONTAINS]->(c:Chunk)-[disc:DISCUSSES]->(con:Concept)
    WITH con, avg(disc.relevance) as avgRelevance, count(c) as chunkCount
    OPTIONAL MATCH (con)-[r:RELATED_TO]-(related:Concept)
    WITH con, avgRelevance, chunkCount,
         collect(DISTINCT {name: related.name, strength: r.strength}) as relatedConcepts
    RETURN con.id as id, con.name as name, con.category as category,
           chunkCount as mentionCount, relatedConcepts
    ORDER BY mentionCount DESC
  `;

  try {
    const graphDb = await getGraphDatabaseSource();
    const result = await graphDb.run(query, { documentId });
    return result.records.map((record) => ({
      id: record.get('id'),
      name: record.get('name'),
      category: record.get('category') as ConceptCategory,
      mentionCount: record.get('mentionCount'),
      relatedConcepts: record.get('relatedConcepts') || [],
    }));
  } catch (error) {
    logger.error(`Error getting concepts for document ${documentId}:`, error);
    return [];
  }
}

/**
 * Get document summary with all entities, concepts, and topics
 */
export async function getDocumentGraphSummary(
  documentId: string
): Promise<DocumentGraphSummary | null> {
  const query = `
    MATCH (d:Document {id: $documentId})
    OPTIONAL MATCH (d)-[:CONTAINS]->(c:Chunk)-[:MENTIONS]->(e:Entity)
    OPTIONAL MATCH (d)-[:CONTAINS]->(c2:Chunk)-[:DISCUSSES]->(con:Concept)
    OPTIONAL MATCH (d)-[:CONTAINS]->(c3:Chunk)-[:ABOUT]->(t:Topic)
    WITH d,
         collect(DISTINCT {name: e.name, type: e.type, count: 1}) as entities,
         collect(DISTINCT {name: con.name, count: 1}) as concepts,
         collect(DISTINCT t.name) as topics
    RETURN d.id as documentId, d.filename as filename, d.totalChunks as totalChunks,
           entities, concepts, topics
  `;

  try {
    const graphDb = await getGraphDatabaseSource();
    const result = await graphDb.run(query, { documentId });
    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    return {
      documentId: record.get('documentId'),
      filename: record.get('filename'),
      totalChunks: record.get('totalChunks'),
      entities: record.get('entities') || [],
      concepts: record.get('concepts') || [],
      topics: record.get('topics') || [],
    };
  } catch (error) {
    logger.error(`Error getting document summary for ${documentId}:`, error);
    return null;
  }
}

/**
 * Get chunks related through shared entities
 * Finds other chunks that mention the same entities.
 * Authorization is enforced at the route boundary; this query trusts the chunkId scope.
 */
export async function getRelatedChunksByEntities(
  chunkId: string,
  limit: number = 3
): Promise<Array<{ id: string; content: string; filename: string; sharedEntities: string[] }>> {
  const query = `
    MATCH (c:Chunk {id: $chunkId})-[:MENTIONS]->(e:Entity)
    MATCH (e)<-[:MENTIONS]-(relatedChunk:Chunk)
    WHERE relatedChunk.id <> $chunkId
    MATCH (relatedChunk)<-[:CONTAINS]-(d:Document)
    WITH relatedChunk, d, collect(DISTINCT e.name) as sharedEntities
    RETURN relatedChunk.id as id,
           relatedChunk.content as content,
           d.filename as filename,
           sharedEntities,
           size(sharedEntities) as entityCount
    ORDER BY entityCount DESC
    LIMIT toInteger($limit)
  `;

  try {
    const graphDb = await getGraphDatabaseSource();
    const result = await graphDb.run(query, { chunkId, limit });
    return result.records.map((record) => ({
      id: record.get('id'),
      content: record.get('content'),
      filename: record.get('filename'),
      sharedEntities: record.get('sharedEntities'),
    }));
  } catch (error) {
    logger.error(`Error getting related chunks for ${chunkId}:`, error);
    return [];
  }
}

/**
 * Get full context for a chunk (previous, current, next + entities with descriptions).
 * Authorization enforced at route boundary; this query trusts the chunkId scope.
 *
 * @param documentIds - restricts IDENTITY cluster membership (see
 *   expandIdentityClusters) to these documents, so a same-named entity in a
 *   document the caller cannot access never surfaces as an IDENTITY relationship.
 */
export async function getChunkWithContext(chunkId: string, documentIds: string[]): Promise<ChunkContext | null> {
  logger.debug(`[GRAPH-QUERY] getChunkWithContext called with chunkId: ${chunkId}`);

  const query = `
    MATCH (c:Chunk {id: $chunkId})
    OPTIONAL MATCH (c)-[:PREVIOUS]->(prev:Chunk)
    OPTIONAL MATCH (c)-[:NEXT]->(next:Chunk)
    OPTIONAL MATCH (c)-[m:MENTIONS]->(e:Entity)
    OPTIONAL MATCH (c)-[d:DISCUSSES]->(con:Concept)
    OPTIONAL MATCH (c)-[:ABOUT]->(t:Topic)
    WITH c, prev, next,
         collect(DISTINCT {
           id: e.id,
           name: e.name,
           type: e.type,
           description: e.description,
           aliases: e.aliases,
           mentionContext: m.context,
           mentionConfidence: m.confidence
         }) as entityDetails,
         collect(DISTINCT {
           id: con.id,
           name: con.name,
           category: con.category,
           description: con.description,
           relevance: d.relevance,
           sentiment: d.sentiment,
           discussionContext: d.context
         }) as conceptDetails,
         collect(DISTINCT t.name) as topics
    RETURN c, prev, next, entityDetails, conceptDetails, topics
  `;

  // Separate query for relationships between entities/concepts in this chunk.
  // Includes:
  // - RELATED edges from extraction (Entity→Concept, Concept→Concept, etc.)
  // - SIMILAR edges from resolution (Entity→Entity), which keep their direct-
  //   adjacency semantics — only IDENTITY is cluster-expanded, computed below
  //   via expandIdentityClusters since membership is not always a direct edge.
  const relationshipQuery = `
    MATCH (c:Chunk {id: $chunkId})
    MATCH (c)-[:MENTIONS|DISCUSSES]->(n1)
    MATCH (c)-[:MENTIONS|DISCUSSES]->(n2)
    WHERE id(n1) < id(n2)
    MATCH (n1)-[r]-(n2)
    WHERE (type(r) = 'RELATED' AND r.chunkId = $chunkId)
       OR type(r) = 'SIMILAR'
    RETURN n1.name as source,
           n2.name as target,
           CASE WHEN type(r) = 'RELATED' THEN r.relationType ELSE type(r) END as relType,
           COALESCE(r.description, r.rationale) as description,
           r.confidence as confidence
    LIMIT 20
  `;

  try {
    logger.debug(`[GRAPH-QUERY] Executing Neo4j query for chunk ${chunkId}`);
    const graphDb = await getGraphDatabaseSource();

    // Run both queries in parallel
    const [contextResult, relationshipResult] = await Promise.all([
      graphDb.run(query, { chunkId }),
      graphDb.run(relationshipQuery, { chunkId }),
    ]);

    logger.debug(`[GRAPH-QUERY] Query returned ${contextResult.records.length} records for chunk ${chunkId}`);

    if (contextResult.records.length === 0) {
      logger.debug(`[GRAPH-QUERY] No records found in Neo4j for chunk ${chunkId}`);
      return null;
    }

    const record = contextResult.records[0];
    const chunk = record.get('c').properties;
    const prev = record.get('prev')?.properties;
    const next = record.get('next')?.properties;

    // Process entity details, filtering out nulls from optional matches
    const rawEntityDetails: Array<{ id: string; name: string; type: string; description: string; aliases: string[]; mentionContext: string; mentionConfidence: number }> =
      (record.get('entityDetails') || []).filter((e: { name: string | null }) => e.name !== null);
    const entityDetails: EntityDetail[] = rawEntityDetails.map((e) => ({
      name: e.name,
      type: e.type || 'UNKNOWN',
      description: e.description || '',
      aliases: e.aliases || [],
      mentionContext: e.mentionContext,
      mentionConfidence: e.mentionConfidence,
    }));

    // Process concept details, filtering out nulls
    const rawConceptDetails: Array<{ id: string; name: string; category: string; description: string; relevance: number; sentiment: string; discussionContext: string }> =
      (record.get('conceptDetails') || []).filter((c: { name: string | null }) => c.name !== null);
    const conceptDetails: ConceptDetail[] = rawConceptDetails.map((c) => ({
      name: c.name,
      category: c.category || 'GENERAL',
      description: c.description || '',
      relevance: c.relevance,
      sentiment: c.sentiment,
      discussionContext: c.discussionContext,
    }));

    // Process direct relationships (RELATED + SIMILAR)
    const relationships: RelationshipDetail[] = relationshipResult.records.map((r) => ({
      source: r.get('source'),
      target: r.get('target'),
      type: r.get('relType'),
      description: r.get('description'),
      confidence: r.get('confidence'),
    }));

    // IDENTITY relationships between the chunk's own mentioned entities/concepts
    // aren't always a direct edge (see expandIdentityClusters) — cluster-expand
    // the mentioned ids and report co-cluster pairs as an IDENTITY relationship.
    const idToName = new Map<string, string>();
    for (const e of rawEntityDetails) {if (e.id) {idToName.set(e.id, e.name);}}
    for (const c of rawConceptDetails) {if (c.id) {idToName.set(c.id, c.name);}}
    const mentionedIds = Array.from(idToName.keys());

    if (mentionedIds.length > 1 && documentIds.length > 0) {
      const clusterMap = await expandIdentityClusters(mentionedIds, documentIds);
      for (let i = 0; i < mentionedIds.length; i++) {
        for (let j = i + 1; j < mentionedIds.length; j++) {
          const idA = mentionedIds[i];
          const idB = mentionedIds[j];
          if ((clusterMap.get(idA) ?? [idA]).includes(idB)) {
            relationships.push({
              source: idToName.get(idA) ?? idA,
              target: idToName.get(idB) ?? idB,
              type: 'IDENTITY',
            });
          }
        }
      }
    }

    return {
      chunk: {
        id: chunk.id,
        content: chunk.content,
        contentNum: chunk.contentNum,
      },
      previousChunk: prev
        ? {
            id: prev.id,
            content: prev.content,
            contentNum: prev.contentNum,
          }
        : undefined,
      nextChunk: next
        ? {
            id: next.id,
            content: next.content,
            contentNum: next.contentNum,
          }
        : undefined,
      entities: entityDetails.map(e => e.name), // Backward compat
      entityDetails,
      concepts: conceptDetails.map(c => c.name), // Backward compat
      conceptDetails,
      relationships,
      topics: record.get('topics') || [],
    };
  } catch (error) {
    logger.error(`Error getting context for chunk ${chunkId}:`, error);
    return null;
  }
}

/**
 * Get relationships between a set of entities
 * Uses a single query (not N per-chunk queries)
 */
export async function getRelationshipsBetweenEntities(
  entityIds: string[]
): Promise<RelationshipDetail[]> {
  // Guard: need at least 2 entities for a relationship
  if (entityIds.length < 2) {
    return [];
  }

  const query = `
    MATCH (e1:Entity)-[r]->(e2:Entity)
    WHERE e1.id IN $entityIds AND e2.id IN $entityIds
    RETURN e1.name as source, type(r) as type, e2.name as target,
           r.description as description, r.confidence as confidence
  `;

  try {
    const graphDb = await getGraphDatabaseSource();
    const result = await graphDb.run(query, { entityIds });

    return result.records.map((record) => ({
      source: record.get('source'),
      target: record.get('target'),
      type: record.get('type'),
      description: record.get('description'),
      confidence: record.get('confidence'),
    }));
  } catch (error) {
    logger.error('[GRAPH-RAG] Error getting relationships between entities:', error);
    return [];
  }
}

/**
 * One-hop expansion from anchor entities and concepts
 * Excludes Chunk neighbors (trust embedding search for raw text)
 * Uses directed matching to explicitly capture source/target
 *
 * SECURITY: Filters neighbors by userId (required) and documentIds (chat scope)
 * to prevent cross-user data leakage during graph traversal.
 *
 * @param anchorEntityIds - Entity IDs to expand from
 * @param anchorConceptIds - Concept IDs to expand from
 * @param documentIds - Document IDs for chat scope filtering (empty = no filtering)
 * @param userId - User ID for security filtering (required)
 * @param limit - Maximum number of results to return
 * @returns OneHopResult array with anchor, relationship, and neighbor info
 */
export async function getOneHopExpansion(
  anchorEntityIds: string[],
  anchorConceptIds: string[],
  documentIds: string[],
  limit: number = 50
): Promise<OneHopResult[]> {
  const allAnchorIds = [...anchorEntityIds, ...anchorConceptIds];
  if (allAnchorIds.length === 0) {
    return [];
  }

  if (documentIds.length === 0) {
    throw new Error('getOneHopExpansion requires non-empty documentIds');
  }

  // Expand every anchor to its full IDENTITY cluster before the neighbor query.
  // Cross-document duplicates of an anchor belong in GraphRAG context (settled
  // product decision — see .agents/plans/graph-identity-cluster-traversal.md):
  // an anchor with 10 cluster members should surface neighbors from all 10,
  // not just the ones a direct/1-hop check happens to reach.
  const clusterMap = await expandIdentityClusters(allAnchorIds, documentIds);
  const expandUnique = (ids: string[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of ids) {
      for (const member of clusterMap.get(id) ?? [id]) {
        if (!seen.has(member)) {
          seen.add(member);
          out.push(member);
        }
      }
    }
    return out;
  };

  const expandedEntityIds = expandUnique(anchorEntityIds);
  const expandedConceptIds = expandUnique(anchorConceptIds);
  const expandedAllAnchorIds = expandUnique(allAnchorIds);

  // PATTERN: Use directed matching like getRelationshipsBetweenEntities
  // Query outgoing relationships: anchor -> neighbor (anchor is source)
  // Query incoming relationships: anchor <- neighbor (neighbor is source)
  // UNION both to get all connections
  //
  // Authorization: documentIds validated at the route boundary via assertDocumentAccess.

  // Entity one-hop query
  // Includes Chunk neighbors (with summary instead of full content)
  // Uses CASE to handle Chunk-specific fields and COALESCE for confidence/relevance
  const entityQuery = `
    MATCH (anchor:Entity)-[r]->(neighbor)
    WHERE anchor.id IN $anchorEntityIds
      AND NOT neighbor.id IN $allAnchorIds
      AND (neighbor.documentId IN $documentIds OR (neighbor:Document AND neighbor.id IN $documentIds))
    RETURN
      anchor.id as anchorId,
      anchor.name as anchorName,
      'ENTITY' as anchorType,
      type(r) as relationType,
      r.description as relationshipDescription,
      r.context as relationshipContext,
      COALESCE(r.confidence, r.relevance) as confidence,
      anchor.name as sourceName,
      CASE WHEN neighbor:Chunk THEN 'Chunk' ELSE neighbor.name END as targetName,
      neighbor.id as neighborId,
      CASE WHEN neighbor:Chunk THEN null ELSE neighbor.name END as neighborName,
      CASE WHEN neighbor:Chunk THEN neighbor.summary ELSE neighbor.description END as neighborDescription,
      labels(neighbor)[0] as neighborType

    UNION

    MATCH (anchor:Entity)<-[r]-(neighbor)
    WHERE anchor.id IN $anchorEntityIds
      AND NOT neighbor.id IN $allAnchorIds
      AND (neighbor.documentId IN $documentIds OR (neighbor:Document AND neighbor.id IN $documentIds))
    RETURN
      anchor.id as anchorId,
      anchor.name as anchorName,
      'ENTITY' as anchorType,
      type(r) as relationType,
      r.description as relationshipDescription,
      r.context as relationshipContext,
      COALESCE(r.confidence, r.relevance) as confidence,
      CASE WHEN neighbor:Chunk THEN 'Chunk' ELSE neighbor.name END as sourceName,
      anchor.name as targetName,
      neighbor.id as neighborId,
      CASE WHEN neighbor:Chunk THEN null ELSE neighbor.name END as neighborName,
      CASE WHEN neighbor:Chunk THEN neighbor.summary ELSE neighbor.description END as neighborDescription,
      labels(neighbor)[0] as neighborType
  `;

  // Concept one-hop query
  // Includes Chunk neighbors (with summary instead of full content)
  // Uses CASE to handle Chunk-specific fields and COALESCE for confidence/relevance
  const conceptQuery = `
    MATCH (anchor:Concept)-[r]->(neighbor)
    WHERE anchor.id IN $anchorConceptIds
      AND NOT neighbor.id IN $allAnchorIds
      AND (neighbor.documentId IN $documentIds OR (neighbor:Document AND neighbor.id IN $documentIds))
    RETURN
      anchor.id as anchorId,
      anchor.name as anchorName,
      'CONCEPT' as anchorType,
      type(r) as relationType,
      r.description as relationshipDescription,
      r.context as relationshipContext,
      COALESCE(r.confidence, r.relevance) as confidence,
      anchor.name as sourceName,
      CASE WHEN neighbor:Chunk THEN 'Chunk' ELSE neighbor.name END as targetName,
      neighbor.id as neighborId,
      CASE WHEN neighbor:Chunk THEN null ELSE neighbor.name END as neighborName,
      CASE WHEN neighbor:Chunk THEN neighbor.summary ELSE neighbor.description END as neighborDescription,
      labels(neighbor)[0] as neighborType

    UNION

    MATCH (anchor:Concept)<-[r]-(neighbor)
    WHERE anchor.id IN $anchorConceptIds
      AND NOT neighbor.id IN $allAnchorIds
      AND (neighbor.documentId IN $documentIds OR (neighbor:Document AND neighbor.id IN $documentIds))
    RETURN
      anchor.id as anchorId,
      anchor.name as anchorName,
      'CONCEPT' as anchorType,
      type(r) as relationType,
      r.description as relationshipDescription,
      r.context as relationshipContext,
      COALESCE(r.confidence, r.relevance) as confidence,
      CASE WHEN neighbor:Chunk THEN 'Chunk' ELSE neighbor.name END as sourceName,
      anchor.name as targetName,
      neighbor.id as neighborId,
      CASE WHEN neighbor:Chunk THEN null ELSE neighbor.name END as neighborName,
      CASE WHEN neighbor:Chunk THEN neighbor.summary ELSE neighbor.description END as neighborDescription,
      labels(neighbor)[0] as neighborType
  `;

  try {
    const graphDb = await getGraphDatabaseSource();

    const queryParams = {
      anchorEntityIds: expandedEntityIds,
      anchorConceptIds: expandedConceptIds,
      allAnchorIds: expandedAllAnchorIds,
      documentIds,
    };

    const [entityResults, conceptResults] = await Promise.all([
      expandedEntityIds.length > 0
        ? graphDb.run(entityQuery, queryParams)
        : Promise.resolve({ records: [] }),
      expandedConceptIds.length > 0
        ? graphDb.run(conceptQuery, queryParams)
        : Promise.resolve({ records: [] }),
    ]);

    const mapRecord = (record: any): OneHopResult => ({
      anchor: {
        id: record.get('anchorId'),
        name: record.get('anchorName'),
        type: record.get('anchorType'),
      },
      relationship: {
        type: record.get('relationType'),
        description: record.get('relationshipDescription'),
        context: record.get('relationshipContext'),
        confidence: record.get('confidence'),
        sourceName: record.get('sourceName'),
        targetName: record.get('targetName'),
      },
      neighbor: {
        id: record.get('neighborId'),
        name: record.get('neighborName'),
        description: record.get('neighborDescription'),
        type: record.get('neighborType'),
      },
    });

    // Combine results and limit
    const allResults = [
      ...entityResults.records.map(mapRecord),
      ...conceptResults.records.map(mapRecord),
    ];

    logger.info(
      `[GRAPH-RAG] One-hop expansion: ${allResults.length} connections from ` +
        `${anchorEntityIds.length} entities and ${anchorConceptIds.length} concepts`
    );

    // Deterministic order before truncation: confidence desc, then neighbor id.
    // Cluster expansion increases row count, so an unordered cap would silently
    // drop a different set of relationships on every request.
    allResults.sort((a, b) => {
      const confidenceDiff = (b.relationship.confidence ?? 0) - (a.relationship.confidence ?? 0);
      if (confidenceDiff !== 0) {return confidenceDiff;}
      return (a.neighbor.id ?? '').localeCompare(b.neighbor.id ?? '');
    });

    // Apply limit after combining (UNION doesn't support LIMIT well)
    return allResults.slice(0, limit);
  } catch (error) {
    logger.error('[GRAPH-RAG] Error in one-hop expansion:', error);
    return [];
  }
}

/**
 * Lookup chunk summaries from Neo4j by embedding IDs.
 * Authorization enforced at the route boundary; this query trusts the embeddingIds scope.
 */
export async function getChunkSummaries(
  embeddingIds: string[]
): Promise<Map<string, string>> {
  const summaryMap = new Map<string, string>();

  if (embeddingIds.length === 0) {
    return summaryMap;
  }

  try {
    const source = await getGraphDatabaseSource();
    const result = await source.run(
      `
      MATCH (ch:Chunk)
      WHERE ch.embeddingId IN $embeddingIds
      RETURN ch.embeddingId as id, ch.summary as summary
      `,
      { embeddingIds }
    );

    for (const record of result.records) {
      const id = record.get('id');
      const summary = record.get('summary');
      if (id && summary) {
        summaryMap.set(id, summary);
      }
    }

    logger.info(`[GRAPH-QUERY] Retrieved ${summaryMap.size} chunk summaries for ${embeddingIds.length} embedding IDs`);
    return summaryMap;
  } catch (error) {
    logger.warn('[GRAPH-QUERY] Failed to retrieve chunk summaries, will use full content', { error });
    return summaryMap;
  }
}

// --- Shortest Path for Explanation Path Enhancement ---

export interface ShortestPathResult {
  startName: string;
  endName: string;
  pathNodes: Array<{ name: string; type: string; description: string }>;
  pathEdges: Array<{ type: string; description: string; direction: string }>;
  formatted: string;
}

/**
 * Find shortest paths between pairs of entity anchors.
 * Used by the explanation path to surface multi-hop connections
 * that 1-hop expansion misses.
 *
 * Two-phase pattern:
 * 1. IDENTITY cluster expansion for each node (expandIdentityClusters) — once
 *    both endpoints are expanded to their full clusters, the path query below
 *    needs no identity slack in its depth budget.
 * 2. shortestPath() with security filters
 * 3. Collapse IDENTITY edges from displayed result
 */
export async function findShortestPaths(
  entityIds: string[],
  documentIds: string[],
  maxPairs: number = 3,
  maxDepth: number = 5,
): Promise<ShortestPathResult[]> {
  if (entityIds.length < 2) {return [];}

  const graphDb = await getGraphDatabaseSource();

  // Generate unique pairs, capped at maxPairs
  const pairs: [string, string][] = [];
  for (let i = 0; i < entityIds.length && pairs.length < maxPairs; i++) {
    for (let j = i + 1; j < entityIds.length && pairs.length < maxPairs; j++) {
      pairs.push([entityIds[i], entityIds[j]]);
    }
  }

  // Phase 1: Expand IDENTITY clusters for all involved nodes. The helper
  // returns ids only, so names are fetched separately (nameMap still feeds
  // the formatted output below).
  const allNodeIds = [...new Set(entityIds)];
  const [clusterMap, nameMap] = await Promise.all([
    expandIdentityClusters(allNodeIds, documentIds),
    (async () => {
      const nameResult = await graphDb.run(
        'MATCH (n) WHERE n.id IN $nodeIds RETURN n.id AS id, n.name AS name',
        { nodeIds: allNodeIds }
      );
      const map = new Map<string, string>();
      for (const record of nameResult.records) {
        const id = record.get('id') as string;
        map.set(id, (record.get('name') as string) ?? id);
      }
      return map;
    })(),
  ]);

  // Phase 2: Find shortest path for each pair (in parallel)
  const results = await Promise.all(
    pairs.map(async ([startId, endId]): Promise<ShortestPathResult | null> => {
      try {
        const startIds = clusterMap.get(startId) ?? [startId];
        const endIds = clusterMap.get(endId) ?? [endId];
        const startName = nameMap.get(startId) ?? startId;
        const endName = nameMap.get(endId) ?? endId;

        const pathQuery = `
          UNWIND $startIds AS sid
          UNWIND $endIds AS eid
          MATCH p = shortestPath((a {id: sid})-[*1..${maxDepth}]-(b {id: eid}))
          WHERE none(r IN relationships(p) WHERE type(r) IN [${FORBIDDEN_REL_TYPES_CYPHER}])
            AND all(n IN nodes(p) WHERE
              n.documentId IN $documentIds OR (n:Document AND n.id IN $documentIds))
          RETURN [n IN nodes(p) | { id: n.id, name: n.name, type: labels(n)[0], description: n.description }] as pathNodes,
                 [i IN range(0, size(relationships(p))-1) | {
                   rawType: type(relationships(p)[i]),
                   type: CASE WHEN relationships(p)[i].relationType IS NOT NULL
                     THEN relationships(p)[i].relationType
                     ELSE type(relationships(p)[i]) END,
                   description: relationships(p)[i].description,
                   direction: CASE WHEN startNode(relationships(p)[i]) = nodes(p)[i] THEN 'outgoing' ELSE 'incoming' END
                 }] as pathEdges
          ORDER BY length(p) ASC
          LIMIT 1
        `;

        const result = await graphDb.run(pathQuery, {
          startIds,
          endIds,
          documentIds,
        });

        if (result.records.length === 0) {return null;}

        const record = result.records[0];
        const rawNodes = record.get('pathNodes') as Array<{ id: string; name: string; type: string; description: string }>;
        const rawEdges = record.get('pathEdges') as Array<{ rawType: string; type: string; description: string; direction: string }>;

        // Collapse IDENTITY edges
        const collapsedNodes: typeof rawNodes = [rawNodes[0]];
        const collapsedEdges: Array<{ type: string; description: string; direction: string }> = [];

        for (let i = 0; i < rawEdges.length; i++) {
          if (rawEdges[i].rawType === 'IDENTITY') {continue;}
          collapsedEdges.push(rawEdges[i]);
          collapsedNodes.push(rawNodes[i + 1]);
        }

        // Build formatted string
        const formatNode = (n: { name: string; type: string; description: string }) => {
          const desc = n.description ? `: ${n.description}` : '';
          return `"${n.name}" (${n.type})${desc}`;
        };

        const lines = [`Shortest path from "${startName}" to "${endName}" (${collapsedNodes.length} nodes):`];
        lines.push(`  ${formatNode(collapsedNodes[0])}`);
        for (let i = 0; i < collapsedEdges.length; i++) {
          const edge = collapsedEdges[i];
          const arrow = edge.direction === 'outgoing' ? '  ->' : '  <-';
          const relDesc = edge.description ? ` | ${edge.description}` : '';
          lines.push(`${arrow} [${edge.type}]${relDesc}`);
          lines.push(`  ${formatNode(collapsedNodes[i + 1])}`);
        }

        return {
          startName,
          endName,
          pathNodes: collapsedNodes,
          pathEdges: collapsedEdges,
          formatted: lines.join('\n'),
        };
      } catch (error) {
        logger.warn('[EXPLANATION] Shortest path failed for pair', {
          startId,
          endId,
          error,
        });
        return null;
      }
    }),
  );

  return results.filter((r): r is ShortestPathResult => r !== null);
}
