import { AIFactory } from '@/features/ai-provider/factory';
import { getScopedGraphSchema } from '@/features/graph-database/dal/getGraphSchema';
import { getGraphDatabaseSource } from '@/features/graph-database';
import { logger } from '@/server/logger';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import { MessageRole } from '@/features/chat/types/message';
import {
  FORBIDDEN_REL_TYPES,
  validateCypherSecurity,
} from '@/features/graph-database/services/cypherUtils';
import getAccessibleDocumentIds from '@/features/shared/dal/getAccessibleDocumentIds';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';
import type { AiRepository } from '@/features/ai-provider/sources/types';

export type QueryType = 'enumeration' | 'explanation' | 'aggregation';
export type SuggestedFormat = 'table' | 'list' | 'prose';

export interface Text2CypherResult {
  query: string;
  generatedCypher: string;
  results: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
  queryType: QueryType;
  suggestedFormat: SuggestedFormat;
}

const MAX_RETRIES = 1;
const FORBIDDEN_REL_TYPES_CYPHER = FORBIDDEN_REL_TYPES.map(
  (relationshipType) => `'${relationshipType}'`,
).join(', ');

export async function text2CypherSearch({
  query,
  documentIds,
  userId,
  userGroupId,
  accessibleDocIds,
  validationFeedback,
}: {
  query: string;
  documentIds: string[];
  userId: string;
  userGroupId?: string;
  accessibleDocIds?: AccessibleDocIds;
  validationFeedback?: { previousCypher: string; issue: string; originalQueryType: QueryType; originalSuggestedFormat: SuggestedFormat };
}): Promise<Text2CypherResult> {
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
      queryType: 'explanation',
      suggestedFormat: 'prose',
    };
  }

  const factory = new AIFactory({ userId, userGroupId });
  const { source, model } = await factory.buildKnowledgeGraphSource();
  const graphDb = await getGraphDatabaseSource();

  let lastError: string | undefined;
  let lastCypher: string | undefined;
  // Initialize from validationFeedback if this is a validation retry
  let lastQueryType: QueryType | undefined = validationFeedback?.originalQueryType;
  let lastSuggestedFormat: SuggestedFormat | undefined = validationFeedback?.originalSuggestedFormat;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      const { generatedCypher, queryType, suggestedFormat } = await generateCypher({
        query,
        schema,
        source,
        modelExternalId: model.externalId,
        attempt,
        validationFeedback: validationFeedback
          ? { previousCypher: validationFeedback.previousCypher, issue: validationFeedback.issue }
          : undefined,
        lastCypher,
        lastError,
        lastQueryType,
        lastSuggestedFormat,
      });
      lastCypher = generatedCypher; // Track for retry error reporting
      lastQueryType = queryType;
      lastSuggestedFormat = suggestedFormat;

      // SECURITY: Validate before execution
      const validation = validateCypherSecurity(generatedCypher);
      if (!validation.valid) {
        logger.warn('[TEXT2CYPHER] Security validation failed', {
          query,
          generatedCypher,
          reason: validation.reason,
        });
        return {
          query,
          generatedCypher,
          results: [],
          rowCount: 0,
          executionTimeMs: Date.now() - startTime,
          error: `Security validation failed: ${validation.reason}`,
          queryType,
          suggestedFormat,
        };
      }

      logger.info('[TEXT2CYPHER] Generated Cypher', {
        query,
        generatedCypher,
        queryType,
        suggestedFormat,
        attempt: attempt + 1,
      });

      const result = await graphDb.run(generatedCypher, { documentIds });

      // GOTCHA: Neo4j integers need .toNumber() conversion
      const results = result.records.map((record) => {
        const obj: Record<string, unknown> = {};
        record.keys.forEach((key) => {
          const keyStr = String(key);
          const value = record.get(keyStr);
          obj[keyStr] = typeof value?.toNumber === 'function' ? value.toNumber() : value;
        });
        return obj;
      });

      logger.info('[TEXT2CYPHER] Execution complete', {
        query,
        rowCount: results.length,
        queryType,
        executionTimeMs: Date.now() - startTime,
      });

      return {
        query,
        generatedCypher,
        results,
        rowCount: results.length,
        executionTimeMs: Date.now() - startTime,
        queryType,
        suggestedFormat,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Query execution failed';
      const isSyntaxError =
        error instanceof Error &&
        (error.message.includes('SyntaxError') ||
          error.message.includes('not defined') ||
          error.message.includes('Invalid input'));

      // Only retry on syntax errors, and only if we haven't exhausted retries
      if (isSyntaxError && attempt < MAX_RETRIES) {
        logger.warn('[TEXT2CYPHER] Syntax error, retrying', {
          query,
          cypher: lastCypher,
          attempt: attempt + 1,
          error: errorMessage,
        });
        lastError = errorMessage;
        attempt++;
        continue;
      }

      logger.error('[TEXT2CYPHER] Failed', { query, error, attempt: attempt + 1 });
      return {
        query,
        generatedCypher: lastCypher || '',
        results: [],
        rowCount: 0,
        executionTimeMs: Date.now() - startTime,
        error: errorMessage,
        queryType: 'explanation',
        suggestedFormat: 'prose',
      };
    }
  }

  // Should never reach here, but TypeScript needs it
  return {
    query,
    generatedCypher: lastCypher || '',
    results: [],
    rowCount: 0,
    executionTimeMs: Date.now() - startTime,
    error: lastError || 'Max retries exceeded',
    queryType: 'explanation',
    suggestedFormat: 'prose',
  };
}

interface CypherGenerationResponse {
  cypher: string;
  queryType: QueryType;
  suggestedFormat: SuggestedFormat;
}

function parseCypherResponse(response: string): CypherGenerationResponse {
  // Strip markdown code blocks if present
  const cleaned = response
    .replace(/```json\n?/gi, '')
    .replace(/```cypher\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      cypher: parsed.cypher || cleaned,
      queryType: parsed.queryType || 'explanation',
      suggestedFormat: parsed.suggestedFormat || 'prose',
    };
  } catch {
    // Fallback: assume it's raw cypher (backward compatibility)
    return {
      cypher: cleaned,
      queryType: 'explanation',
      suggestedFormat: 'prose',
    };
  }
}

export interface CypherGenerationParams {
  query: string;
  schema: string;
  source: AiRepository;
  modelExternalId: string;
  /** 0 → buildCypherPrompt (or validation retry if validationFeedback set); >0 → buildRetryPrompt. */
  attempt: number;
  validationFeedback?: { previousCypher: string; issue: string };
  /** Required when attempt > 0 (drives the syntax-error retry prompt). */
  lastCypher?: string;
  lastError?: string;
  /** Preserve the first-attempt classification across retries (it shouldn't change on a syntax fix). */
  lastQueryType?: QueryType;
  lastSuggestedFormat?: SuggestedFormat;
}

/**
 * Shared generation step for the cypher paths: select the right prompt, call the
 * model, parse the response, and preserve the first-attempt classification.
 *
 * Uses this file's LOCAL parseCypherResponse (which returns queryType) — NOT the
 * cypherUtils export, which drops queryType and would silently degrade everything
 * to 'explanation'.
 */
export async function generateCypher(
  p: CypherGenerationParams,
): Promise<{ generatedCypher: string; queryType: QueryType; suggestedFormat: SuggestedFormat }> {
  let prompt: string;
  if (p.attempt === 0 && p.validationFeedback) {
    prompt = buildValidationRetryPrompt(p.query, p.schema, p.validationFeedback.previousCypher, p.validationFeedback.issue);
  } else if (p.attempt === 0) {
    prompt = buildCypherPrompt(p.query, p.schema);
  } else {
    // Syntax error retry
    prompt = buildRetryPrompt(p.query, p.schema, p.lastCypher ?? '', p.lastError ?? '');
  }

  const response = await p.source.chatCompletion(
    [{ role: MessageRole.User, content: prompt }],
    { model: p.modelExternalId, temperature: 0.1, topP: 0 },
  );

  const parsed = parseCypherResponse(response.text);
  return {
    generatedCypher: parsed.cypher,
    // Preserve queryType/suggestedFormat from first attempt - classification shouldn't change on a syntax fix
    queryType: p.lastQueryType ?? parsed.queryType,
    suggestedFormat: p.lastSuggestedFormat ?? parsed.suggestedFormat,
  };
}

function buildCypherPrompt(query: string, schema: string): string {
  return `You are a Cypher query generator for Neo4j. Generate a READ-ONLY query to answer the user's question.

SCHEMA:
${schema}

SECURITY RULES (MANDATORY):
1. ALWAYS include: WHERE ... documentId IN $documentIds (and use (n:Document AND n.id IN $documentIds) for Document nodes)
2. EVERY node whose properties you RETURN — and every node you COUNT or aggregate over, including OPTIONAL MATCH targets — must be constrained with documentId IN $documentIds (Document nodes: n:Document AND n.id IN $documentIds). A traversal MATCH (a)-[r]-(b) that returns or counts b MUST also filter b.documentId IN $documentIds.
3. Use the $documentIds parameter - never hardcode values
4. Do NOT add WHERE ... userId = $userId predicates - the route boundary enforces authorization

QUERY RULES:
1. Use toLower() for case-insensitive name matching
2. Return meaningful column aliases
3. For counts, use count(DISTINCT x) to avoid duplicates
4. Only READ operations - no CREATE, MERGE, SET, DELETE
5. Never return IDs to the user - return human-readable names instead
6. When returning document information, join to Document node and return d.filename, not documentId
7. When listing entities or concepts, use DISTINCT to avoid duplicates unless user asks about document-level occurrences
8. For Chunk nodes, never project ch.content — use ch.summary for chunk text. Full chunk text is large and pushes the result past the agent's row limit, which collapses per-item citations into a coarse whole-set answer; the full text stays on the node.

CYPHER PITFALLS - AVOID THESE MISTAKES:
1. You CANNOT reference an alias in the same WITH clause where it's defined
   BAD:  WITH d.filename as doc, collect(DISTINCT doc) as docs
   GOOD: WITH collect(DISTINCT d.filename) as docs
2. Variables go out of scope after WITH - include them if needed later
   BAD:  MATCH (e:Entity) ... WITH d.filename as doc RETURN e.name  -- e is out of scope!
   GOOD: MATCH (e:Entity) ... WITH e, d.filename as doc RETURN e.name
3. Non-aggregated columns in WITH become grouping keys
   BAD:  MATCH (e:Entity) RETURN e.type, e.name, count(*)  -- groups by BOTH type AND name
   GOOD: MATCH (e:Entity) WITH e.type as type, count(*) as cnt RETURN type, cnt
4. UNION requires identical column names - avoid UNION for multi-count queries
   BAD:  MATCH (e:Entity) RETURN count(e) as entityCount UNION MATCH (c:Concept) RETURN count(c) as conceptCount
   GOOD: MATCH (e:Entity) WITH count(e) as entityCount MATCH (c:Concept) RETURN entityCount, count(c) as conceptCount

IDENTITY RELATIONSHIPS:
- IDENTITY edges link the same entity across documents - do NOT report as a "connection"
- When returning relationships, filter with WHERE type(r) <> 'IDENTITY'
- IDENTITY clusters are not always a single edge — the same entity can be split across several documents and linked by a short chain of IDENTITY edges. For shortestPath() between two named entities, use a generous hop bound (e.g. *..8) so a real connection isn't missed behind a few identity hops

CLASSIFICATION:
- enumeration: List of items (list all, show every, what entities)
- explanation: Details about specific items (what is, explain, describe)
- aggregation: Computed summary (count, most common, total)

EXAMPLES:

Question: "List all entities"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds RETURN DISTINCT e.name as name, e.type as type, e.description as description", "queryType": "enumeration", "suggestedFormat": "table" }

Question: "How many entities are there?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds RETURN count(DISTINCT e) as entityCount", "queryType": "aggregation", "suggestedFormat": "prose" }

Question: "How many entities and concepts are there?" or "Count of entities and concepts"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds WITH count(DISTINCT e) as entityCount MATCH (c:Concept) WHERE c.documentId IN $documentIds RETURN entityCount, count(DISTINCT c) as conceptCount", "queryType": "aggregation", "suggestedFormat": "prose" }

Question: "What is PEO DHMS?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds AND toLower(e.name) CONTAINS 'peo dhms' RETURN e.name as name, e.description as description, e.type as type", "queryType": "explanation", "suggestedFormat": "prose" }

Question: "What people are mentioned?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds AND toLower(e.type) = 'person' RETURN DISTINCT e.name as person, e.description as description", "queryType": "enumeration", "suggestedFormat": "table" }

Question: "What entities are connected to John Smith?"
{ "cypher": "MATCH (e1:Entity)-[r]-(e2:Entity) WHERE e1.documentId IN $documentIds AND toLower(e1.name) CONTAINS 'john smith' AND e2.documentId IN $documentIds AND type(r) <> 'IDENTITY' RETURN DISTINCT e1.name as source, type(r) as relationship, e2.name as target", "queryType": "enumeration", "suggestedFormat": "table" }

Question: "How many entities of each type?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds RETURN e.type as type, count(DISTINCT e) as count ORDER BY count DESC", "queryType": "enumeration", "suggestedFormat": "table" }

Question: "What entities are shared across documents?" or "What entities appear in multiple documents?" or "Which entities are common vs unique?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds MATCH (d:Document {id: e.documentId}) WITH e.name as name, e.type as type, collect(DISTINCT d.filename) as documents, count(DISTINCT e.documentId) as docCount RETURN name, type, documents, CASE WHEN docCount > 1 THEN 'shared' ELSE 'unique' END as status ORDER BY docCount DESC, name", "queryType": "enumeration", "suggestedFormat": "table" }

Question: "Show me a breakdown of entities in common and not in common across documents"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds MATCH (d:Document {id: e.documentId}) WITH e.name as name, e.type as type, collect(DISTINCT d.filename) as documents, count(DISTINCT e.documentId) as docCount, size($documentIds) as totalDocs RETURN name, type, documents, CASE WHEN docCount = totalDocs THEN 'common to all' WHEN docCount > 1 THEN 'shared by some' ELSE 'unique' END as status ORDER BY docCount DESC, name", "queryType": "enumeration", "suggestedFormat": "table" }

Question: "What entities are unique to each document?" or "What entities only appear in one document?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds MATCH (d:Document {id: e.documentId}) WITH e.name as name, e.type as type, collect(DISTINCT d.filename) as documents, count(DISTINCT e.documentId) as docCount WHERE docCount = 1 RETURN name, type, documents[0] as document", "queryType": "enumeration", "suggestedFormat": "table" }

Question: "Which documents mention entity X?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds AND toLower(e.name) CONTAINS 'entity x' MATCH (d:Document {id: e.documentId}) RETURN DISTINCT d.filename as document, e.name as entity", "queryType": "enumeration", "suggestedFormat": "table" }

Question: "How is A related to B?" or "What's the connection between A and B?"
{ "cypher": "MATCH path = shortestPath((e1:Entity)-[*..8]-(e2:Entity)) WHERE none(r IN relationships(path) WHERE type(r) IN [${FORBIDDEN_REL_TYPES_CYPHER}]) AND e1.documentId IN $documentIds AND e2.documentId IN $documentIds AND toLower(e1.name) CONTAINS 'a' AND toLower(e2.name) CONTAINS 'b' AND e1 <> e2 RETURN e1.name as from, [n IN nodes(path) | n.name] as path, e2.name as to LIMIT 5", "queryType": "explanation", "suggestedFormat": "prose" }

Question: "What are the most connected entities?" or "Most important entities?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds OPTIONAL MATCH (e)-[r]-(other) WHERE other.documentId IN $documentIds AND type(r) <> 'IDENTITY' WITH e, count(r) as connections RETURN e.name as name, e.type as type, connections ORDER BY connections DESC LIMIT 10", "queryType": "enumeration", "suggestedFormat": "table" }

Question: "List all concepts"
{ "cypher": "MATCH (c:Concept) WHERE c.documentId IN $documentIds RETURN DISTINCT c.name as name, c.category as category, c.description as description", "queryType": "enumeration", "suggestedFormat": "table" }

Question: "What concepts are related to entity X?"
{ "cypher": "MATCH (e:Entity)-[r]-(c:Concept) WHERE e.documentId IN $documentIds AND toLower(e.name) CONTAINS 'entity x' AND c.documentId IN $documentIds RETURN DISTINCT e.name as entity, type(r) as relationship, c.name as concept", "queryType": "enumeration", "suggestedFormat": "table" }

Question: "How many entities per document?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds MATCH (d:Document {id: e.documentId}) RETURN d.filename as document, count(DISTINCT e) as entityCount ORDER BY entityCount DESC", "queryType": "enumeration", "suggestedFormat": "table" }

Question: "What relationship types exist?"
{ "cypher": "MATCH (e1:Entity)-[r]-(e2:Entity) WHERE e1.documentId IN $documentIds AND type(r) <> 'IDENTITY' RETURN DISTINCT type(r) as relationshipType, count(*) as count ORDER BY count DESC", "queryType": "enumeration", "suggestedFormat": "table" }

Question: "How is concept X related to other concepts?" or "What concepts are related to concept X?"
{ "cypher": "MATCH (c1:Concept)-[r]-(c2:Concept) WHERE c1.documentId IN $documentIds AND toLower(c1.name) CONTAINS 'concept x' AND c2.documentId IN $documentIds AND type(r) <> 'IDENTITY' RETURN DISTINCT c1.name as concept, type(r) as relationship, c2.name as relatedConcept", "queryType": "enumeration", "suggestedFormat": "table" }

Question: "What entities is concept X connected to?" or "What entities are related to concept X?"
{ "cypher": "MATCH (c:Concept)-[r]-(e:Entity) WHERE c.documentId IN $documentIds AND toLower(c.name) CONTAINS 'concept x' AND e.documentId IN $documentIds RETURN DISTINCT c.name as concept, type(r) as relationship, e.name as entity, e.type as entityType", "queryType": "enumeration", "suggestedFormat": "table" }

Question: "What is X connected to?" or "What entities or concepts are connected to X?" (when X could be either Entity or Concept)
{ "cypher": "MATCH (n)-[r]-(other) WHERE n.documentId IN $documentIds AND toLower(n.name) CONTAINS 'x' AND other.documentId IN $documentIds AND type(r) <> 'IDENTITY' RETURN DISTINCT n.name as source, labels(n)[0] as sourceType, type(r) as relationship, other.name as target, labels(other)[0] as targetType", "queryType": "enumeration", "suggestedFormat": "table" }

Question: "How is X discussed?" or "What context mentions X?" or "Show me the discussion around X"
{ "cypher": "MATCH (ch:Chunk)-[r:DISCUSSES]->(c:Concept) WHERE c.documentId IN $documentIds AND toLower(c.name) CONTAINS 'x' MATCH (d:Document {id: ch.documentId}) RETURN c.name as concept, r.context as context, r.sentiment as sentiment, d.filename as document, ch.summary as chunkSummary", "queryType": "enumeration", "suggestedFormat": "table" }

Question: "Where is entity X mentioned?" or "What context mentions entity X?"
{ "cypher": "MATCH (ch:Chunk)-[r:MENTIONS]->(e:Entity) WHERE e.documentId IN $documentIds AND toLower(e.name) CONTAINS 'x' MATCH (d:Document {id: ch.documentId}) RETURN e.name as entity, r.context as context, r.sentiment as sentiment, d.filename as document, ch.summary as chunkSummary", "queryType": "enumeration", "suggestedFormat": "table" }

Question: "What concepts are shared across documents?" or "Which concepts appear in multiple documents?"
{ "cypher": "MATCH (c:Concept) WHERE c.documentId IN $documentIds MATCH (d:Document {id: c.documentId}) WITH c.name as name, c.category as category, collect(DISTINCT d.filename) as documents, count(DISTINCT c.documentId) as docCount RETURN name, category, documents, CASE WHEN docCount > 1 THEN 'shared' ELSE 'unique' END as status ORDER BY docCount DESC, name", "queryType": "enumeration", "suggestedFormat": "table" }

USER QUESTION: ${query}

Respond with JSON only. No explanation, no markdown code blocks.`;
}

function buildRetryPrompt(query: string, schema: string, failedCypher: string, error: string): string {
  return `You are a Cypher query generator for Neo4j. Your previous query had a syntax error. Fix it.

SCHEMA:
${schema}

SECURITY RULES (MANDATORY):
1. ALWAYS include: WHERE ... documentId IN $documentIds (and use (n:Document AND n.id IN $documentIds) for Document nodes)
2. EVERY node whose properties you RETURN — and every node you COUNT or aggregate over, including OPTIONAL MATCH targets — must be constrained with documentId IN $documentIds (Document nodes: n:Document AND n.id IN $documentIds). A traversal MATCH (a)-[r]-(b) that returns or counts b MUST also filter b.documentId IN $documentIds.
3. Use the $documentIds parameter - never hardcode values
4. Do NOT add WHERE ... userId = $userId predicates - the route boundary enforces authorization

QUERY RULES:
1. Use toLower() for case-insensitive name matching
2. Return meaningful column aliases
3. For counts, use count(DISTINCT x) to avoid duplicates
4. Only READ operations - no CREATE, MERGE, SET, DELETE
5. Never return IDs to the user - return human-readable names instead
6. When returning document information, join to Document node and return d.filename, not documentId
7. When listing entities or concepts, use DISTINCT to avoid duplicates unless user asks about document-level occurrences
8. For Chunk nodes, never project ch.content — use ch.summary for chunk text. Full chunk text is large and pushes the result past the agent's row limit, which collapses per-item citations into a coarse whole-set answer; the full text stays on the node.

CYPHER PITFALLS TO AVOID:
- You CANNOT reference an alias in the same WITH clause where it's defined
- BAD: WITH d.filename as doc, collect(DISTINCT doc) as docs  -- "doc" not defined yet!
- GOOD: WITH d.filename as doc WITH collect(DISTINCT doc) as docs  -- two separate WITH clauses
- OR: WITH collect(DISTINCT d.filename) as docs  -- use original variable directly

PREVIOUS ATTEMPT (FAILED):
\`\`\`cypher
${failedCypher}
\`\`\`

ERROR MESSAGE:
${error}

USER QUESTION: ${query}

Fix the Cypher query and respond with JSON only:
{
  "cypher": "...",
  "queryType": "enumeration" | "explanation" | "aggregation",
  "suggestedFormat": "table" | "list" | "prose"
}`;
}

function buildValidationRetryPrompt(query: string, schema: string, previousCypher: string, validationIssue: string): string {
  return `You are a Cypher query generator for Neo4j. Your previous query executed successfully but the result structure didn't match what the user was asking for.

SCHEMA:
${schema}

SECURITY RULES (MANDATORY):
1. ALWAYS include: WHERE ... documentId IN $documentIds (and use (n:Document AND n.id IN $documentIds) for Document nodes)
2. EVERY node whose properties you RETURN — and every node you COUNT or aggregate over, including OPTIONAL MATCH targets — must be constrained with documentId IN $documentIds (Document nodes: n:Document AND n.id IN $documentIds). A traversal MATCH (a)-[r]-(b) that returns or counts b MUST also filter b.documentId IN $documentIds.
3. Use the $documentIds parameter - never hardcode values
4. Do NOT add WHERE ... userId = $userId predicates - the route boundary enforces authorization

QUERY RULES:
1. Use toLower() for case-insensitive name matching
2. Return meaningful column aliases
3. For counts, use count(DISTINCT x) to avoid duplicates
4. Only READ operations - no CREATE, MERGE, SET, DELETE
5. Never return IDs to the user - return human-readable names instead
6. When returning document information, join to Document node and return d.filename, not documentId
7. When listing entities or concepts, use DISTINCT to avoid duplicates unless user asks about document-level occurrences
8. For Chunk nodes, never project ch.content — use ch.summary for chunk text. Full chunk text is large and pushes the result past the agent's row limit, which collapses per-item citations into a coarse whole-set answer; the full text stays on the node.

PREVIOUS QUERY (worked but wrong structure):
\`\`\`cypher
${previousCypher}
\`\`\`

VALIDATION ISSUE:
${validationIssue}

USER QUESTION: ${query}

Generate a DIFFERENT Cypher query that better addresses the user's question. Think about:
- What columns/structure would best answer this question?
- Should you group, aggregate, or pivot the data differently?
- Are you returning the right level of detail?

Respond with JSON only:
{
  "cypher": "...",
  "queryType": "enumeration" | "explanation" | "aggregation",
  "suggestedFormat": "table" | "list" | "prose"
}`;
}
