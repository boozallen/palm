import { AIFactory } from '@/features/ai-provider/factory';
import { getScopedGraphSchema } from '@/features/graph-database/dal/getGraphSchema';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import { MessageRole } from '@/features/chat/types/message';
import { logger } from '@/server/logger';
import getAccessibleDocumentIds from '@/features/shared/dal/getAccessibleDocumentIds';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';
import {
  validateCypherSecurity,
  parseCypherResponse,
  executeCypher,
  isSyntaxError,
  fixShortTermContains,
  SECURITY_RULES,
  CYPHER_PITFALLS,
  QUERY_RULES,
  IDENTITY_RULES,
} from './cypherUtils';

const MAX_RETRIES = 2;

/**
 * Result from an enumeration query (text2cypher for lists)
 */
export interface EnumerationResult {
  query: string;
  generatedCypher: string;
  results: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
  suggestedFormat: 'table';
  queryType: 'enumeration';
}

/**
 * Execute an enumeration query (list queries) using text2cypher.
 *
 * Generates Cypher from natural language to list entities, concepts,
 * relationships, or other items from the knowledge graph.
 *
 * @param query - User's natural language question
 * @param documentIds - Document scope for the query
 * @param userId - User ID for security filtering
 * @returns EnumerationResult with results or error
 */
export async function enumerationQuery({
  query,
  documentIds,
  userId,
  accessibleDocIds,
  userGroupId,
}: {
  query: string;
  documentIds: string[];
  userId: string;
  accessibleDocIds?: AccessibleDocIds;
  userGroupId?: string;
}): Promise<EnumerationResult> {
  const startTime = Date.now();
  const effectiveAccessibleDocIds = accessibleDocIds ?? await getAccessibleDocumentIds(userId);
  const schema = await getScopedGraphSchema(effectiveAccessibleDocIds, documentIds);
  const systemConfig = await getSystemConfig();

  if (!systemConfig.knowledgeGraphAiProviderModelId) {
    return {
      query,
      generatedCypher: '',
      results: [],
      rowCount: 0,
      executionTimeMs: Date.now() - startTime,
      error: 'Knowledge graph AI provider not configured',
      suggestedFormat: 'table',
      queryType: 'enumeration',
    };
  }

  const factory = new AIFactory({ userId, userGroupId });
  const { source, model } = await factory.buildKnowledgeGraphSource();

  let lastError: string | undefined;
  let lastCypher: string | undefined;
  const failedAttempts: { cypher: string; error: string }[] = [];
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      const prompt =
        attempt === 0
          ? buildEnumerationPrompt(query, schema)
          : buildRetryPrompt(query, schema, failedAttempts);

      const response = await source.chatCompletion(
        [{ role: MessageRole.User, content: prompt }],
        { model: model.externalId, temperature: 0.1, topP: 0 }
      );

      const { cypher: rawCypher } = parseCypherResponse(response.text);
      const cypher = fixShortTermContains(rawCypher);
      lastCypher = cypher;

      const validation = validateCypherSecurity(cypher);
      if (!validation.valid) {
        if (attempt < MAX_RETRIES) {
          logger.warn('[ENUMERATION] Security validation failed, retrying', {
            cypher,
            reason: validation.reason,
            attempt,
          });
          lastError = `Security validation failed: ${validation.reason}. You MUST include the WHERE ... documentId IN $documentIds filter (and use (n:Document AND n.id IN $documentIds) for Document nodes).`;
          lastCypher = cypher;
          failedAttempts.push({ cypher, error: lastError });
          attempt++;
          continue;
        }
        logger.warn('[ENUMERATION] Security validation failed after retries', {
          cypher,
          reason: validation.reason,
        });
        return {
          query,
          generatedCypher: cypher,
          results: [],
          rowCount: 0,
          executionTimeMs: Date.now() - startTime,
          error: `Security validation failed: ${validation.reason}`,
          suggestedFormat: 'table',
          queryType: 'enumeration',
        };
      }

      // Validate _nodeId presence (required for graph visualization)
      const lowerCypher = cypher.toLowerCase();
      if (!lowerCypher.includes('_nodeid') && !lowerCypher.includes('_nodeids')) {
        if (attempt < MAX_RETRIES) {
          logger.warn('[ENUMERATION] Missing _nodeId in RETURN, retrying', { cypher, attempt });
          lastError = 'Missing _nodeId: For each entity/concept column in RETURN, include its .id with prefix _nodeId_ followed by the EXACT column alias. Example: e.id AS _nodeId_name, e.name AS name. For aggregations, use collect(DISTINCT e.id) AS _nodeId_name in WITH.';
          lastCypher = cypher;
          failedAttempts.push({ cypher, error: lastError });
          attempt++;
          continue;
        }
        // If out of retries, proceed anyway — table just won't have graph linking
        logger.warn('[ENUMERATION] Missing _nodeId after retries, proceeding without', { cypher });
      }

      logger.info('[ENUMERATION] Generated Cypher', {
        query: query.substring(0, 50),
        cypher,
        attempt: attempt + 1,
      });

      const execResult = await executeCypher(cypher, { documentIds });

      if (execResult.error) {
        if (isSyntaxError(execResult.error) && attempt < MAX_RETRIES) {
          logger.warn('[ENUMERATION] Syntax error, retrying', {
            error: execResult.error,
            attempt,
          });
          lastError = execResult.error;
          failedAttempts.push({ cypher, error: lastError });
          attempt++;
          continue;
        }

        return {
          query,
          generatedCypher: cypher,
          results: [],
          rowCount: 0,
          executionTimeMs: Date.now() - startTime,
          error: execResult.error,
          suggestedFormat: 'table',
          queryType: 'enumeration',
        };
      }

      // Self-correction: if 0 results and we haven't exhausted retries, try once more with feedback
      if (execResult.rowCount === 0 && attempt < MAX_RETRIES) {
        logger.info('[ENUMERATION] Query returned 0 results, attempting self-correction', {
          cypher,
          attempt,
        });
        lastError = 'Query executed successfully but returned 0 results.';
        lastCypher = cypher;
        failedAttempts.push({ cypher, error: lastError });
        attempt++;
        continue;
      }

      logger.info('[ENUMERATION] Query executed successfully', {
        rowCount: execResult.rowCount,
        executionTimeMs: execResult.executionTimeMs,
      });

      return {
        query,
        generatedCypher: cypher,
        results: execResult.results,
        rowCount: execResult.rowCount,
        executionTimeMs: Date.now() - startTime,
        suggestedFormat: 'table',
        queryType: 'enumeration',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[ENUMERATION] Unexpected error', { error: errorMsg, attempt });
      lastError = errorMsg;
      attempt++;
    }
  }

  return {
    query,
    generatedCypher: lastCypher || '',
    results: [],
    rowCount: 0,
    executionTimeMs: Date.now() - startTime,
    error: lastError || 'Max retries exceeded',
    suggestedFormat: 'table',
    queryType: 'enumeration',
  };
}

/**
 * Build the enumeration prompt with focused examples for list queries.
 */
function buildEnumerationPrompt(query: string, schema: string): string {
  return `You are a Cypher query generator for Neo4j. Generate a READ-ONLY query to list items.

SCHEMA:
${schema}

${SECURITY_RULES}

${QUERY_RULES}

${IDENTITY_RULES}

${CYPHER_PITFALLS}

IMPORTANT - USER-FACING OUTPUT ONLY:
NEVER return internal metadata fields. Only return fields meaningful to end users.

FORBIDDEN FIELDS (never include in RETURN as user-facing columns):
- documentId, userId, embeddingId (internal IDs)
- status, createdAt, updatedAt, totalChunks, totalTokens (internal metadata)
- chunkIndex, startPosition, endPosition (internal processing data)
- Any field ending in "Id" or "At" (except _nodeId_ prefixed columns which are required below)

ALLOWED FIELDS for Documents: filename (or name), description
ALLOWED FIELDS for Entities: name, type, description, aliases
ALLOWED FIELDS for Concepts: name, category, description
ALLOWED FIELDS for Chunks: summary, content (NOT internal metadata)

GRAPH VISUALIZATION (MANDATORY):
For each entity/concept NAME column in your RETURN, include its .id with prefix _nodeId_ followed by the EXACT column alias. These are stripped automatically and never shown to users.

RULES:
- The part after _nodeId_ MUST exactly match the column alias (case-sensitive)
- Only entity/concept NAME columns get a _nodeId_ column. Do NOT add _nodeId_ for attribute columns like type, description, category, relationship, count, status, document, etc.
- When the node is in scope at RETURN: e.id AS _nodeId_name, e.name AS name
- When the node is out of scope (after WITH/aggregation): collect(DISTINCT e.id) AS _nodeId_name in the WITH and RETURN
- When query involves two entity/concept columns: include BOTH, e.g., e.id AS _nodeId_company, person.id AS _nodeId_person
- For pure count/aggregation queries with no individual entity names: omit _nodeId_

ENUMERATION EXAMPLES:

Question: "List all entities"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds RETURN DISTINCT e.id AS _nodeId_name, e.name as name, e.type as type, e.description as description", "suggestedFormat": "table" }

Question: "What people are mentioned?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds AND toLower(e.type) = 'person' RETURN DISTINCT e.id AS _nodeId_person, e.name as person, e.description as description", "suggestedFormat": "table" }

Question: "List all AI companies"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds AND e.type = 'ORGANIZATION' AND (e.name =~ '(?i).*\\\\bai\\\\b.*' OR e.description =~ '(?i).*\\\\bai\\\\b.*') RETURN DISTINCT e.id AS _nodeId_company, e.name as company, e.description as description", "suggestedFormat": "table" }

Question: "What entities are connected to John Smith?"
{ "cypher": "MATCH (e1:Entity)-[r]-(e2:Entity) WHERE e1.documentId IN $documentIds AND toLower(e1.name) CONTAINS 'john smith' AND e2.documentId IN $documentIds AND type(r) <> 'IDENTITY' RETURN DISTINCT e1.id AS _nodeId_source, e2.id AS _nodeId_target, e1.name as source, type(r) as relationship, e2.name as target", "suggestedFormat": "table" }

Question: "How many entities of each type?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds RETURN e.type as type, count(DISTINCT e) as count ORDER BY count DESC", "suggestedFormat": "table" }

Question: "What entities are shared across documents?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds MATCH (d:Document {id: e.documentId}) WITH e.name as name, e.type as type, collect(DISTINCT e.id) as _nodeId_name, collect(DISTINCT d.filename) as documents, count(DISTINCT e.documentId) as docCount RETURN _nodeId_name, name, type, documents, CASE WHEN docCount > 1 THEN 'shared' ELSE 'unique' END as status ORDER BY docCount DESC, name", "suggestedFormat": "table" }

Question: "Show me a breakdown of entities in common and not in common across documents"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds MATCH (d:Document {id: e.documentId}) WITH e.name as name, e.type as type, collect(DISTINCT e.id) as _nodeId_name, collect(DISTINCT d.filename) as documents, count(DISTINCT e.documentId) as docCount, size($documentIds) as totalDocs RETURN _nodeId_name, name, type, documents, CASE WHEN docCount = totalDocs THEN 'common to all' WHEN docCount > 1 THEN 'shared by some' ELSE 'unique' END as status ORDER BY docCount DESC, name", "suggestedFormat": "table" }

Question: "What entities are unique to each document?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds MATCH (d:Document {id: e.documentId}) WITH e.name as name, e.type as type, collect(DISTINCT e.id) as _nodeId_name, collect(DISTINCT d.filename) as documents, count(DISTINCT e.documentId) as docCount WHERE docCount = 1 RETURN _nodeId_name, name, type, documents[0] as document", "suggestedFormat": "table" }

Question: "Which documents mention entity X?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds AND toLower(e.name) CONTAINS 'entity x' MATCH (d:Document {id: e.documentId}) RETURN DISTINCT e.id AS _nodeId_entity, d.filename as document, e.name as entity", "suggestedFormat": "table" }

Question: "What are the most connected entities?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds OPTIONAL MATCH (e)-[r]-() WHERE type(r) <> 'IDENTITY' WITH e, count(r) as connections RETURN e.id AS _nodeId_name, e.name as name, e.type as type, connections ORDER BY connections DESC LIMIT 10", "suggestedFormat": "table" }

Question: "List all concepts"
{ "cypher": "MATCH (c:Concept) WHERE c.documentId IN $documentIds RETURN DISTINCT c.id AS _nodeId_name, c.name as name, c.category as category, c.description as description", "suggestedFormat": "table" }

Question: "What concepts are related to entity X?"
{ "cypher": "MATCH (e:Entity)-[r]-(c:Concept) WHERE e.documentId IN $documentIds AND toLower(e.name) CONTAINS 'entity x' AND c.documentId IN $documentIds RETURN DISTINCT e.id AS _nodeId_entity, c.id AS _nodeId_concept, e.name as entity, type(r) as relationship, c.name as concept", "suggestedFormat": "table" }

Question: "How many entities per document?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds MATCH (d:Document {id: e.documentId}) RETURN d.filename as document, count(DISTINCT e) as entityCount ORDER BY entityCount DESC", "suggestedFormat": "table" }

Question: "What relationship types exist?"
{ "cypher": "MATCH (e1:Entity)-[r]-(e2:Entity) WHERE e1.documentId IN $documentIds AND type(r) <> 'IDENTITY' RETURN DISTINCT type(r) as relationshipType, count(*) as count ORDER BY count DESC", "suggestedFormat": "table" }

Question: "How is concept X related to other concepts?"
{ "cypher": "MATCH (c1:Concept)-[r]-(c2:Concept) WHERE c1.documentId IN $documentIds AND toLower(c1.name) CONTAINS 'concept x' AND c2.documentId IN $documentIds AND type(r) <> 'IDENTITY' RETURN DISTINCT c1.id AS _nodeId_concept, c2.id AS _nodeId_relatedConcept, c1.name as concept, type(r) as relationship, c2.name as relatedConcept", "suggestedFormat": "table" }

Question: "What entities is concept X connected to?"
{ "cypher": "MATCH (c:Concept)-[r]-(e:Entity) WHERE c.documentId IN $documentIds AND toLower(c.name) CONTAINS 'concept x' AND e.documentId IN $documentIds RETURN DISTINCT c.id AS _nodeId_concept, e.id AS _nodeId_entity, c.name as concept, type(r) as relationship, e.name as entity, e.type as entityType", "suggestedFormat": "table" }

Question: "What is X connected to?"
{ "cypher": "MATCH (n)-[r]-(other) WHERE n.documentId IN $documentIds AND toLower(n.name) CONTAINS 'x' AND other.documentId IN $documentIds AND type(r) <> 'IDENTITY' RETURN DISTINCT n.id AS _nodeId_source, other.id AS _nodeId_target, n.name as source, labels(n)[0] as sourceType, type(r) as relationship, other.name as target, labels(other)[0] as targetType", "suggestedFormat": "table" }

Question: "How is X discussed?"
{ "cypher": "MATCH (ch:Chunk)-[r:DISCUSSES]->(c:Concept) WHERE c.documentId IN $documentIds AND toLower(c.name) CONTAINS 'x' MATCH (d:Document {id: ch.documentId}) RETURN c.id AS _nodeId_concept, c.name as concept, r.context as context, r.sentiment as sentiment, d.filename as document, ch.summary as chunkSummary", "suggestedFormat": "table" }

Question: "Where is entity X mentioned?"
{ "cypher": "MATCH (ch:Chunk)-[r:MENTIONS]->(e:Entity) WHERE e.documentId IN $documentIds AND toLower(e.name) CONTAINS 'x' MATCH (d:Document {id: ch.documentId}) RETURN e.id AS _nodeId_entity, e.name as entity, r.context as context, r.sentiment as sentiment, d.filename as document, ch.summary as chunkSummary", "suggestedFormat": "table" }

Question: "What concepts are shared across documents?"
{ "cypher": "MATCH (c:Concept) WHERE c.documentId IN $documentIds MATCH (d:Document {id: c.documentId}) WITH c.name as name, c.category as category, collect(DISTINCT c.id) as _nodeId_name, collect(DISTINCT d.filename) as documents, count(DISTINCT c.documentId) as docCount RETURN _nodeId_name, name, category, documents, CASE WHEN docCount > 1 THEN 'shared' ELSE 'unique' END as status ORDER BY docCount DESC, name", "suggestedFormat": "table" }

Question: "Give me an overview of my documents" or "What documents do I have?"
{ "cypher": "MATCH (d:Document) WHERE d.id IN $documentIds OPTIONAL MATCH (e:Entity {documentId: d.id}) WITH d, count(DISTINCT e.name) as entityCount OPTIONAL MATCH (c:Concept {documentId: d.id}) WITH d, entityCount, count(DISTINCT c.name) as conceptCount RETURN d.filename as document, entityCount as entities, conceptCount as concepts", "suggestedFormat": "table" }

Question: "Tell me about this document" or "What is this document about?" or "Summarize this document"
{ "cypher": "MATCH (n) WHERE n.documentId IN $documentIds AND (n:Entity OR n:Concept) OPTIONAL MATCH (n)-[r]-() WHERE type(r) <> 'IDENTITY' WITH n, labels(n)[0] as nodeType, count(r) as connections RETURN n.id AS _nodeId_name, n.name as name, nodeType as type, n.description as description, n.category as category, connections ORDER BY connections DESC LIMIT 20", "suggestedFormat": "table" }

Question: "What do these documents have in common?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds WITH e.name as name, e.type as type, e.description as description, collect(DISTINCT e.id) as _nodeId_name, count(DISTINCT e.documentId) as docCount WHERE docCount > 1 RETURN _nodeId_name, name, type, description, docCount as sharedAcrossDocuments ORDER BY docCount DESC, name", "suggestedFormat": "table" }

Question: "Who are the people involved in fintech?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds AND e.type = 'PERSON' AND (toLower(e.description) CONTAINS 'fintech' OR EXISTS { MATCH (e)-[:RELATED]-(c:Concept) WHERE c.documentId IN $documentIds AND toLower(c.name) CONTAINS 'fintech' }) RETURN DISTINCT e.id AS _nodeId_person, e.name as person, e.description as description", "suggestedFormat": "table" }

USER QUESTION: ${query}

Respond with JSON only: { "cypher": "...", "suggestedFormat": "table" }`;
}

/**
 * Build a retry prompt for syntax error recovery.
 */
function buildRetryPrompt(
  query: string,
  schema: string,
  failedAttempts: { cypher: string; error: string }[],
): string {
  const attemptsSection = failedAttempts.map((a, i) =>
    `Attempt ${i + 1}:\n\`\`\`cypher\n${a.cypher}\n\`\`\`\nError: ${a.error}`
  ).join('\n\n');

  return `You are a Cypher query generator for Neo4j. Your previous queries failed. Diagnose the issue and generate a corrected query. Do NOT repeat the same approach — try a fundamentally different strategy.

SCHEMA:
${schema}

${SECURITY_RULES}

${QUERY_RULES}

GRAPH VISUALIZATION (MANDATORY):
For each entity/concept NAME column in your RETURN, include its .id with prefix _nodeId_ followed by the EXACT column alias:
- When the node is in scope at RETURN: e.id AS _nodeId_name, e.name AS name
- When the node is out of scope (after WITH/aggregation): collect(DISTINCT e.id) AS _nodeId_name
- When query involves two entity columns: e.id AS _nodeId_company, person.id AS _nodeId_person
- Only entity/concept NAME columns get _nodeId_. NOT type, description, relationship, count columns.
- For pure count/aggregation queries with no individual entity names: omit _nodeId_

PREVIOUS ATTEMPTS (ALL FAILED):
${attemptsSection}

${CYPHER_PITFALLS}

USER QUESTION: ${query}

Fix the Cypher query. Respond with JSON only: { "cypher": "...", "suggestedFormat": "table" }`;
}
