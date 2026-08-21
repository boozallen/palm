import { randomUUID } from 'crypto';
import { getGraphDatabaseSource } from '@/features/graph-database';
import type { GraphTransaction } from '@/features/graph-database/sources/types';
import { logger } from '@/server/logger';
import { ChunkAnalysis, ChunkNode } from '@/features/graph-database/types';
import { getExtractionRules } from '@/features/graph-database/utils/signals';
import { findRelationshipNodes, validateRelationshipType } from '@/features/graph-database/services/relationshipMapper';
import { RESERVED_NODE_KEYS, RESERVED_EDGE_KEYS } from '@/features/graph-database/services/compileSchema';

/**
 * Drop any property key that collides with an infra field so custom
 * (schema-driven) properties can never clobber `id`, `type`, `documentId`, etc.
 * Returns a plain map suitable for a Cypher `SET n += $props` (an empty map is a
 * no-op).
 */
function stripReserved(
  props: Record<string, string | number | boolean> | undefined,
  reserved: ReadonlySet<string>
): Record<string, string | number | boolean> {
  if (!props) {
    return {};
  }

  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!reserved.has(key)) {
      safe[key] = value;
    }
  }

  return safe;
}

/**
 * Resumable per-chunk graph writer
 *
 * Interleaves extraction and writing at the chunk level, using the Neo4j graph
 * itself as the durable checkpoint. Each chunk's entities, concepts, and
 * relationships are written inside a SINGLE transaction that also flips the
 * chunk's `extracted` marker to true — so a chunk commits fully or rolls back
 * fully. On resume, already-`extracted` chunks are skipped (no LLM re-call, no
 * duplicate writes).
 *
 * Within the chunk transaction, queries run via `tx.run` (Neo4j read-your-writes)
 * with no per-item try/catch, so a failed query aborts the whole chunk
 * transaction (all-or-nothing) — surfacing real failures instead of silently
 * dropping nodes. Same-document entity/concept dedup uses the extraction-phase
 * rules from signals.config.ts.
 */

/**
 * Return the set of chunk IDs already marked `extracted = true` for a document.
 * Used on resume to skip chunks that were fully written in a prior run.
 */
export async function getExtractedChunkIds(documentId: string): Promise<Set<string>> {
  const graphDb = await getGraphDatabaseSource();
  const result = await graphDb.run(
    `MATCH (d:Document {id: $documentId})-[:CONTAINS]->(c:Chunk)
     WHERE c.extracted = true
     RETURN c.id AS id`,
    { documentId }
  );

  return new Set(result.records.map(r => r.get('id') as string));
}

/**
 * Whether a document has finished its extraction pass (all chunks written and
 * embeddings generated). Used on resume to skip fully-done documents entirely.
 * Returns false when the document node does not exist yet.
 */
export async function isDocumentExtractionComplete(documentId: string): Promise<boolean> {
  const graphDb = await getGraphDatabaseSource();
  const result = await graphDb.run(
    `MATCH (d:Document {id: $documentId})
     RETURN coalesce(d.extractionComplete, false) AS done`,
    { documentId }
  );

  if (result.records.length === 0) {
    return false;
  }

  return result.records[0].get('done') === true;
}

/**
 * Mark a document's extraction pass complete (set after its embedding step
 * finishes) so a subsequent resume skips it.
 */
export async function markDocumentExtractionComplete(documentId: string): Promise<void> {
  const graphDb = await getGraphDatabaseSource();
  await graphDb.run(
    `MATCH (d:Document {id: $documentId})
     SET d.extractionComplete = true`,
    { documentId }
  );

  logger.info(`[GRAPH-BUILD] Marked document extraction complete: ${documentId}`);
}

/**
 * Whether a document has finished its entity-resolution pass. Mirrors
 * `isDocumentExtractionComplete`, but for the cross-document resolution phase.
 * The build gate derives incremental-vs-full routing from this per-document
 * marker (plus `extractionComplete`) instead of the coarse graph-level
 * `status: Completed` flag, so a build that died mid-resolution does not force
 * the next build to re-resolve the user's whole corpus.
 * Returns false when the document node does not exist yet.
 */
export async function isDocumentResolutionComplete(documentId: string): Promise<boolean> {
  const graphDb = await getGraphDatabaseSource();
  const result = await graphDb.run(
    `MATCH (d:Document {id: $documentId})
     RETURN coalesce(d.resolutionComplete, false) AS done`,
    { documentId }
  );

  if (result.records.length === 0) {
    return false;
  }

  return result.records[0].get('done') === true;
}

/**
 * Mark a document's entity-resolution pass complete (set after the document's
 * cross-document resolution finishes) so the build gate treats it as already
 * resolved. Schema-less Neo4j property, mirroring `extractionComplete` — no
 * Prisma migration. Deleting the document node (DETACH DELETE on delete) drops
 * this marker with it, so a re-added document re-resolves.
 */
export async function markDocumentResolutionComplete(documentId: string): Promise<void> {
  const graphDb = await getGraphDatabaseSource();
  await graphDb.run(
    `MATCH (d:Document {id: $documentId})
     SET d.resolutionComplete = true`,
    { documentId }
  );

  logger.info(`[GRAPH-BUILD] Marked document resolution complete: ${documentId}`);
}

/**
 * Atomically write a single chunk's graph contribution.
 *
 * Within one transaction, in order:
 *   1. MERGE the Chunk node + CONTAINS edge (extracted = false initially)
 *   2. MERGE the NEXT edge from the previous chunk (if any)
 *   3. create/merge entities (+ MENTIONS edges)
 *   4. create/merge concepts (+ DISCUSSES edges)
 *   5. create/merge typed RELATED relationships
 *   6. SET extracted = true
 *   7. commit
 *
 * If any step throws, the transaction is rolled back so the chunk leaves no
 * partial state and `extracted` stays unset → it is cleanly reprocessed on
 * resume.
 */
export async function writeChunkGraph(params: {
  documentId: string;
  chunk: ChunkNode;
  prevChunkId: string | null;
  position: number;
  analysis: ChunkAnalysis;
  userId: string;
  allowedRelationTypes?: string[];
  schemaKey?: string;
}): Promise<void> {
  const { documentId, chunk, prevChunkId, position, analysis, userId, allowedRelationTypes, schemaKey } = params;

  const graphDb = await getGraphDatabaseSource();
  const session = await graphDb.getSession();
  const tx = session.beginTransaction();

  try {
    // 1. Chunk node + CONTAINS edge
    await tx.run(
      `MATCH (d:Document {id: $documentId})
       SET d.schemaKey = coalesce($schemaKey, d.schemaKey)
       MERGE (c:Chunk {id: $chunkId})
       SET c.content = $content,
           c.contentNum = $contentNum,
           c.tokenCount = $tokenCount,
           c.createdAt = datetime($createdAt),
           c.embeddingId = $embeddingId,
           c.summary = $summary,
           c.documentId = $documentId,
           c.userId = $userId,
           c.startPosition = $startPosition,
           c.endPosition = $endPosition,
           c.extracted = false
       MERGE (d)-[:CONTAINS {position: $position}]->(c)`,
      {
        documentId,
        chunkId: chunk.id,
        content: chunk.content,
        contentNum: chunk.contentNum,
        tokenCount: chunk.tokenCount,
        createdAt: chunk.createdAt.toISOString(),
        embeddingId: chunk.embeddingId,
        summary: chunk.summary || '',
        position,
        userId,
        startPosition: chunk.startPosition ?? null,
        endPosition: chunk.endPosition ?? null,
        schemaKey: schemaKey ?? null,
      }
    );

    // 2. NEXT edge from previous chunk
    if (prevChunkId) {
      await tx.run(
        `MATCH (prev:Chunk {id: $prevChunkId})
         MATCH (curr:Chunk {id: $currChunkId})
         MERGE (prev)-[:NEXT {overlapTokens: $overlapTokens}]->(curr)`,
        {
          prevChunkId,
          currChunkId: chunk.id,
          overlapTokens: 500,
        }
      );
    }

    // 3-5. Entities, then concepts, then relationships (order matters:
    // relationship matching relies on the MENTIONS/DISCUSSES edges created above
    // being visible within this same transaction — read-your-writes).
    await createEntitiesForChunkTx(tx, analysis, documentId, userId);
    await createConceptsForChunkTx(tx, analysis, documentId, userId);
    await createRelationshipsForChunkTx(tx, analysis, documentId, allowedRelationTypes);

    // 6. Mark the chunk extracted (the durable checkpoint)
    await tx.run(
      `MATCH (c:Chunk {id: $chunkId})
       SET c.extracted = true`,
      { chunkId: chunk.id }
    );

    // 7. Commit
    await tx.commit();

    logger.debug(`[GRAPH-BUILD] Wrote chunk graph (extracted): ${chunk.id}`);
  } catch (error) {
    await tx.rollback();
    logger.error(`[GRAPH-BUILD] Failed to write chunk graph, rolled back: ${chunk.id}`, error);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Checkpoint a chunk whose entity extraction failed after retries.
 *
 * Writes ONLY the chunk node + structural edges (CONTAINS, NEXT) in a single
 * transaction, marking it `extracted = true` (so resume skips it like any
 * committed chunk) plus `extractionSkipped = true` with a `skipReason`. No
 * entities, concepts, or relationships are written. This keeps one bad chunk
 * from aborting the whole document build while leaving a durable, queryable
 * trace of which chunk was skipped and why; the chunk text and NEXT chain stay
 * intact. The Cypher mirrors steps 1-2 of writeChunkGraph.
 */
export async function writeSkippedChunk(params: {
  documentId: string;
  chunk: ChunkNode;
  prevChunkId: string | null;
  position: number;
  userId: string;
  reason: string;
}): Promise<void> {
  const { documentId, chunk, prevChunkId, position, userId, reason } = params;

  const graphDb = await getGraphDatabaseSource();
  const session = await graphDb.getSession();
  const tx = session.beginTransaction();

  try {
    // Chunk node + CONTAINS edge (mirror writeChunkGraph step 1), flagged skipped
    await tx.run(
      `MATCH (d:Document {id: $documentId})
       MERGE (c:Chunk {id: $chunkId})
       SET c.content = $content,
           c.contentNum = $contentNum,
           c.tokenCount = $tokenCount,
           c.createdAt = datetime($createdAt),
           c.embeddingId = $embeddingId,
           c.summary = $summary,
           c.documentId = $documentId,
           c.userId = $userId,
           c.startPosition = $startPosition,
           c.endPosition = $endPosition,
           c.extracted = true,
           c.extractionSkipped = true,
           c.skipReason = $reason
       MERGE (d)-[:CONTAINS {position: $position}]->(c)`,
      {
        documentId,
        chunkId: chunk.id,
        content: chunk.content,
        contentNum: chunk.contentNum,
        tokenCount: chunk.tokenCount,
        createdAt: chunk.createdAt.toISOString(),
        embeddingId: chunk.embeddingId,
        summary: chunk.summary || '',
        position,
        userId,
        startPosition: chunk.startPosition ?? null,
        endPosition: chunk.endPosition ?? null,
        reason,
      }
    );

    // NEXT edge from previous chunk (mirror writeChunkGraph step 2)
    if (prevChunkId) {
      await tx.run(
        `MATCH (prev:Chunk {id: $prevChunkId})
         MATCH (curr:Chunk {id: $currChunkId})
         MERGE (prev)-[:NEXT {overlapTokens: $overlapTokens}]->(curr)`,
        {
          prevChunkId,
          currChunkId: chunk.id,
          overlapTokens: 500,
        }
      );
    }

    await tx.commit();

    logger.warn(`[GRAPH-BUILD] Wrote skipped-chunk marker (extraction skipped): ${chunk.id} — ${reason}`);
  } catch (error) {
    await tx.rollback();
    logger.error(`[GRAPH-BUILD] Failed to write skipped-chunk marker, rolled back: ${chunk.id}`, error);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Create or merge a chunk's entities within the open transaction.
 *
 * DEDUPLICATION: Uses extraction-phase rules from signals.config.ts:
 * - Rule 1 (same_doc_same_name): Same document + exact name match → merge
 * - Rule 2 (same_doc_alias_overlap): Same document + alias overlap → merge
 *
 * Within the chunk's transaction, the dedup MATCH for entity N sees entities
 * 1..N-1 created earlier in the SAME tx (Neo4j read-your-writes).
 */
async function createEntitiesForChunkTx(
  tx: GraphTransaction,
  analysis: ChunkAnalysis,
  documentId: string,
  userId: string
): Promise<void> {
  if (analysis.entities.length === 0) {
    return;
  }

  const extractionRules = getExtractionRules();

  // Check which extraction rules are enabled
  const sameNameRuleEnabled = extractionRules.some(r => r.name === 'same_doc_same_name' && r.enabled);
  const aliasOverlapRuleEnabled = extractionRules.some(r => r.name === 'same_doc_alias_overlap' && r.enabled);

  for (const entity of analysis.entities) {
    const normalizedName = entity.text.toLowerCase().trim();

    // Find existing entity to merge with based on extraction rules
    let existingEntityId: string | null = null;
    let matchedRule: string | null = null;

    // Rule 1: Check for exact name match (same_doc_same_name)
    if (sameNameRuleEnabled && !existingEntityId) {
      const exactNameResult = await tx.run(
        `MATCH (e:Entity {normalizedName: $normalizedName, documentId: $documentId})
         RETURN e.id as id LIMIT 1`,
        { normalizedName, documentId }
      );

      if (exactNameResult.records.length > 0) {
        existingEntityId = exactNameResult.records[0].get('id');
        matchedRule = 'same_doc_same_name';
      }
    }

    // Rule 2: Check for alias overlap (same_doc_alias_overlap)
    // This catches cases like "DHA" and "Defense Health Agency" sharing an alias
    // CONSERVATIVE: Requires same type to avoid merging e.g. "JFK" (PERSON) with "JFK Airport" (LOCATION)
    if (aliasOverlapRuleEnabled && !existingEntityId) {
      const aliasOverlapResult = await tx.run(
        `MATCH (e:Entity {documentId: $documentId, type: $type})
         WHERE e.normalizedName IN $newEntityAliasesLower
            OR any(existingAlias IN e.aliases WHERE toLower(existingAlias) IN $newEntityAllNamesLower)
            OR any(newAlias IN $newEntityAliases WHERE toLower(newAlias) = e.normalizedName)
         RETURN e.id as id LIMIT 1`,
        {
          documentId,
          type: entity.type,
          newEntityAliases: entity.aliases,
          newEntityAliasesLower: entity.aliases.map(a => a.toLowerCase().trim()),
          newEntityAllNamesLower: [normalizedName, ...entity.aliases.map(a => a.toLowerCase().trim())],
        }
      );

      if (aliasOverlapResult.records.length > 0) {
        existingEntityId = aliasOverlapResult.records[0].get('id');
        matchedRule = 'same_doc_alias_overlap';
      }
    }

    if (existingEntityId) {
      // MERGE: Entity exists - add MENTIONS edge (with context), update metadata, and concatenate description
      await tx.run(
        `MATCH (c:Chunk {id: $chunkId})
         MATCH (e:Entity {id: $entityId})
         MERGE (c)-[m:MENTIONS]->(e)
         ON CREATE SET m.count = 1, m.positions = $positions, m.confidence = $confidence, m.context = $context
         ON MATCH SET m.count = m.count + 1
         SET e.mentionCount = e.mentionCount + 1,
             e.aliases = [x IN e.aliases WHERE NOT x IN $newAliases] + $newAliases,
             e.description = CASE
               WHEN e.description IS NULL OR e.description = '' THEN $newDescription
               WHEN $newDescription IS NULL OR $newDescription = '' THEN e.description
               WHEN e.description CONTAINS $newDescription THEN e.description
               ELSE e.description + ' | ' + $newDescription
             END`,
        {
          chunkId: analysis.chunkId,
          entityId: existingEntityId,
          positions: entity.positions,
          confidence: entity.confidence,
          context: entity.context,
          // Include the extracted name itself as an alias so relationship queries can find it
          newAliases: [entity.text, ...entity.aliases],
          newDescription: entity.description || '',
        }
      );

      logger.debug(`Merged entity mention: ${entity.text} (existing id: ${existingEntityId}, rule: ${matchedRule})`);
    } else {
      // CREATE: New entity - generate UUID and create Neo4j node only
      // Embedding generation and PostgreSQL record creation are deferred to
      // the embedding phase after all chunks are processed
      const entityId = randomUUID();

      await tx.run(
        `MATCH (c:Chunk {id: $chunkId})
         CREATE (e:Entity {
           id: $entityId,
           name: $name,
           normalizedName: $normalizedName,
           type: $type,
           description: $description,
           aliases: $aliases,
           documentId: $documentId,
           userId: $userId,
           mentionCount: 1,
           firstSeenAt: datetime(),
           needsEmbedding: true
         })
         CREATE (c)-[m:MENTIONS {
           count: 1,
           positions: $positions,
           confidence: $confidence,
           context: $context
         }]->(e)
         SET e += $customProps`,
        {
          chunkId: analysis.chunkId,
          entityId,
          name: entity.text,
          normalizedName,
          type: entity.type,
          description: entity.description,
          aliases: entity.aliases,
          documentId: documentId,
          userId: userId,
          positions: entity.positions,
          confidence: entity.confidence,
          context: entity.context,
          // Custom (schema-driven) props on CREATE only; reserved infra keys stripped.
          customProps: stripReserved(entity.properties, RESERVED_NODE_KEYS),
        }
      );

      logger.debug(`Created new entity: ${entity.text} (id: ${entityId}, embedding deferred)`);
    }
  }
}

/**
 * Create or merge a chunk's concepts within the open transaction.
 *
 * DEDUPLICATION: Uses extraction-phase rules from signals.config.ts:
 * - Rule 1 (same_doc_same_name): Same document + exact name match → merge
 *
 * Note: Concepts don't have aliases, so Rule 2 (alias overlap) doesn't apply.
 */
async function createConceptsForChunkTx(
  tx: GraphTransaction,
  analysis: ChunkAnalysis,
  documentId: string,
  userId: string
): Promise<void> {
  if (analysis.concepts.length === 0) {
    return;
  }

  const extractionRules = getExtractionRules();

  // Check if same_doc_same_name rule is enabled (concepts only use this rule)
  const sameNameRuleEnabled = extractionRules.some(r => r.name === 'same_doc_same_name' && r.enabled);

  for (const concept of analysis.concepts) {
    const normalizedName = concept.name.toLowerCase().trim();

    let existingConceptId: string | null = null;

    // Rule 1: Check for exact name match (same_doc_same_name)
    // Note: For concepts, we also match on category to distinguish between
    // e.g., "Machine Learning" as TECHNICAL vs BUSINESS concept
    if (sameNameRuleEnabled) {
      const existingResult = await tx.run(
        `MATCH (c:Concept {normalizedName: $normalizedName, category: $category, documentId: $documentId})
         RETURN c.id as id LIMIT 1`,
        { normalizedName, category: concept.category, documentId }
      );

      if (existingResult.records.length > 0) {
        existingConceptId = existingResult.records[0].get('id');
      }
    }

    if (existingConceptId) {
      // MERGE: Concept exists - add DISCUSSES edge, update metadata, and concatenate description
      await tx.run(
        `MATCH (chunk:Chunk {id: $chunkId})
         MATCH (concept:Concept {id: $conceptId})
         MERGE (chunk)-[d:DISCUSSES]->(concept)
         ON CREATE SET d.relevance = $relevance, d.sentiment = $sentiment, d.context = $context
         SET concept.mentionCount = concept.mentionCount + 1,
             concept.description = CASE
               WHEN concept.description IS NULL OR concept.description = '' THEN $newDescription
               WHEN $newDescription IS NULL OR $newDescription = '' THEN concept.description
               WHEN concept.description CONTAINS $newDescription THEN concept.description
               ELSE concept.description + ' | ' + $newDescription
             END`,
        {
          chunkId: analysis.chunkId,
          conceptId: existingConceptId,
          relevance: concept.relevance,
          sentiment: concept.sentiment,
          context: concept.context,
          newDescription: concept.description || '',
        }
      );

      logger.debug(`Merged concept mention: ${concept.name} (existing id: ${existingConceptId})`);
    } else {
      // CREATE: New concept - generate UUID and create Neo4j node only
      const conceptId = randomUUID();

      await tx.run(
        `MATCH (chunk:Chunk {id: $chunkId})
         CREATE (concept:Concept {
           id: $conceptId,
           name: $name,
           normalizedName: $normalizedName,
           category: $category,
           description: $description,
           documentId: $documentId,
           userId: $userId,
           mentionCount: 1,
           firstSeenAt: datetime(),
           needsEmbedding: true
         })
         CREATE (chunk)-[d:DISCUSSES {
           relevance: $relevance,
           sentiment: $sentiment,
           context: $context
         }]->(concept)
         SET concept += $customProps`,
        {
          chunkId: analysis.chunkId,
          conceptId,
          name: concept.name,
          normalizedName,
          category: concept.category,
          description: concept.description,
          documentId: documentId,
          userId: userId,
          relevance: concept.relevance,
          sentiment: concept.sentiment,
          context: concept.context,
          // Custom (schema-driven) props on CREATE only; reserved infra keys stripped.
          customProps: stripReserved(concept.properties, RESERVED_NODE_KEYS),
        }
      );

      logger.debug(`Created new concept: ${concept.name} (id: ${conceptId}, embedding deferred)`);
    }
  }
}

/**
 * Create a chunk's typed RELATED relationships within the open transaction.
 *
 * Creates RELATED edges with a relationType property for extracted
 * relationships. Each relationship is MERGE'd with a unique key
 * (chunkId, sourceName, targetName, relationType) so reprocessing the same
 * chunk is idempotent. Matching relies on the MENTIONS/DISCUSSES edges created
 * earlier in this same transaction (read-your-writes).
 */
async function createRelationshipsForChunkTx(
  tx: GraphTransaction,
  analysis: ChunkAnalysis,
  documentId: string,
  allowedRelationTypes?: string[]
): Promise<void> {
  if (analysis.relationships.length === 0) {
    return;
  }

  let createdCount = 0;

  for (const rel of analysis.relationships) {
    // 1. Validate relationship type against the active schema's edge types
    const normalizedType = validateRelationshipType(rel.relationType, allowedRelationTypes);

    // 2. Find source and target nodes
    const nodes = findRelationshipNodes(
      rel.source,
      rel.target,
      analysis.entities,
      analysis.concepts
    );

    if (!nodes) {
      logger.warn(`Skipping relationship: ${rel.source} -[${rel.relationType}]-> ${rel.target} (nodes not found)`);
      continue;
    }

    // 3. MERGE RELATED edge with unique key (chunkId, sourceName, targetName, relationType)
    // Match by name OR normalizedName OR alias membership to handle merged entities.
    await tx.run(
      `MATCH (chunk:Chunk {id: $chunkId})
       MATCH (chunk)-[:MENTIONS|DISCUSSES]->(source)
       WHERE source.name = $sourceName
          OR source.normalizedName = $sourceNameLower
          OR $sourceName IN source.aliases
       MATCH (chunk)-[:MENTIONS|DISCUSSES]->(target)
       WHERE target.name = $targetName
          OR target.normalizedName = $targetNameLower
          OR $targetName IN target.aliases
       MERGE (source)-[r:RELATED {chunkId: $chunkId, relationType: $relationType}]->(target)
       ON CREATE SET
         r.id = $relationshipId,
         r.phase = 'extraction',
         r.description = $description,
         r.context = $context,
         r.documentId = $documentId,
         r.confidence = $confidence,
         r.decidedBy = 'llm',
         r += $customRelProps
       ON MATCH SET
         r.description = $description,
         r.context = $context,
         r.confidence = $confidence`,
      {
        sourceName: nodes.source.name,
        sourceNameLower: nodes.source.name.toLowerCase().trim(),
        targetName: nodes.target.name,
        targetNameLower: nodes.target.name.toLowerCase().trim(),
        relationshipId: randomUUID(),
        relationType: normalizedType,
        description: rel.description,
        context: rel.context,
        documentId: documentId,
        chunkId: analysis.chunkId,
        confidence: rel.confidence,
        // Custom (schema-driven) edge props on CREATE only; reserved infra keys stripped.
        customRelProps: stripReserved(rel.properties, RESERVED_EDGE_KEYS),
      }
    );

    createdCount++;
  }

  if (createdCount > 0) {
    logger.info(`Created ${createdCount} typed relationships for chunk ${analysis.chunkId}`);
  }
}
