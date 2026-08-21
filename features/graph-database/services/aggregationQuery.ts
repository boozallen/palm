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
  SECURITY_RULES,
  CYPHER_PITFALLS,
  QUERY_RULES,
} from './cypherUtils';

const MAX_RETRIES = 1;

/**
 * Result from an aggregation query (text2cypher for counts/stats)
 */
export interface AggregationResult {
  query: string;
  generatedCypher: string;
  results: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
  suggestedFormat: 'prose';
  queryType: 'aggregation';
}

/**
 * Execute an aggregation query (count/stats queries) using text2cypher.
 *
 * Generates Cypher from natural language to compute counts, statistics,
 * and other aggregated values from the knowledge graph.
 *
 * @param query - User's natural language question
 * @param documentIds - Document scope for the query
 * @param userId - User ID for security filtering
 * @returns AggregationResult with results or error
 */
export async function aggregationQuery({
  query,
  documentIds,
  userId,
  accessibleDocIds,
}: {
  query: string;
  documentIds: string[];
  userId: string;
  accessibleDocIds?: AccessibleDocIds;
}): Promise<AggregationResult> {
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
      suggestedFormat: 'prose',
      queryType: 'aggregation',
    };
  }

  const factory = new AIFactory({ userId });
  const { source, model } = await factory.buildKnowledgeGraphSource();

  let lastError: string | undefined;
  let lastCypher: string | undefined;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      const prompt =
        attempt === 0
          ? buildAggregationPrompt(query, schema)
          : buildRetryPrompt(query, schema, lastCypher!, lastError!);

      const response = await source.chatCompletion(
        [{ role: MessageRole.User, content: prompt }],
        { model: model.externalId, temperature: 0.1, topP: 0 }
      );

      const { cypher } = parseCypherResponse(response.text);
      lastCypher = cypher;

      const validation = validateCypherSecurity(cypher);
      if (!validation.valid) {
        logger.warn('[AGGREGATION] Security validation failed', {
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
          suggestedFormat: 'prose',
          queryType: 'aggregation',
        };
      }

      logger.info('[AGGREGATION] Generated Cypher', {
        query: query.substring(0, 50),
        cypher,
        attempt: attempt + 1,
      });

      const execResult = await executeCypher(cypher, { documentIds });

      if (execResult.error) {
        if (isSyntaxError(execResult.error) && attempt < MAX_RETRIES) {
          logger.warn('[AGGREGATION] Syntax error, retrying', {
            error: execResult.error,
            attempt,
          });
          lastError = execResult.error;
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
          suggestedFormat: 'prose',
          queryType: 'aggregation',
        };
      }

      logger.info('[AGGREGATION] Query executed successfully', {
        rowCount: execResult.rowCount,
        executionTimeMs: execResult.executionTimeMs,
      });

      return {
        query,
        generatedCypher: cypher,
        results: execResult.results,
        rowCount: execResult.rowCount,
        executionTimeMs: Date.now() - startTime,
        suggestedFormat: 'prose',
        queryType: 'aggregation',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[AGGREGATION] Unexpected error', { error: errorMsg, attempt });
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
    suggestedFormat: 'prose',
    queryType: 'aggregation',
  };
}

/**
 * Build the aggregation prompt with focused examples for count/stats queries.
 */
function buildAggregationPrompt(query: string, schema: string): string {
  return `You are a Cypher query generator for Neo4j. Generate a READ-ONLY query for counts/statistics.

SCHEMA:
${schema}

${SECURITY_RULES}

${QUERY_RULES}

${CYPHER_PITFALLS}

IMPORTANT - USER-FACING OUTPUT ONLY:
NEVER return internal metadata fields unless the user SPECIFICALLY asks for them.

FORBIDDEN FIELDS (do not return unless explicitly requested):
- id, documentId, userId, embeddingId (internal IDs)
- status, createdAt, updatedAt (internal timestamps)
- totalChunks, totalTokens, chunkIndex (internal processing data)

For document overviews/summaries, return COUNTS of entities/concepts, NOT document metadata.
Example: For "give me an overview" → count entities and concepts per document, NOT chunk counts or timestamps.

AGGREGATION PITFALL - COUNTING UNIQUE NAMES VS NODES:
- The same entity/concept can exist as separate nodes across documents
- count(DISTINCT e) counts distinct NODES (may overcount if same name appears in multiple docs)
- count(DISTINCT e.name) counts distinct NAMES (what users typically want)
- Use count(DISTINCT e.name) when counting unique people, organizations, etc.
- Use count(DISTINCT e) only when counting document-level occurrences

AGGREGATION EXAMPLES:

Question: "How many people are there?" or "How many people are in these documents?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds AND toLower(e.type) = 'person' RETURN count(DISTINCT e.name) as peopleCount", "suggestedFormat": "prose" }

Question: "How many unique entities are there?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds RETURN count(DISTINCT e.name) as entityCount", "suggestedFormat": "prose" }

Question: "How many entity nodes exist?" (counting document-level occurrences)
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds RETURN count(DISTINCT e) as entityNodeCount", "suggestedFormat": "prose" }

Question: "How many unique entities and concepts are there?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds WITH count(DISTINCT e.name) as entityCount MATCH (c:Concept) WHERE c.documentId IN $documentIds RETURN entityCount, count(DISTINCT c.name) as conceptCount", "suggestedFormat": "prose" }

Question: "What's the average number of entities per document?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds WITH e.documentId as docId, count(DISTINCT e) as entityCount RETURN avg(entityCount) as averageEntitiesPerDocument", "suggestedFormat": "prose" }

Question: "Which entity type is most common?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds RETURN e.type as type, count(DISTINCT e) as count ORDER BY count DESC LIMIT 1", "suggestedFormat": "prose" }

Question: "How many relationships exist in total?"
{ "cypher": "MATCH (e1:Entity)-[r]-(e2:Entity) WHERE e1.documentId IN $documentIds AND type(r) <> 'IDENTITY' RETURN count(r) as totalRelationships", "suggestedFormat": "prose" }

Question: "What percentage of entities are shared across documents?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds WITH e.name as name, count(DISTINCT e.documentId) as docCount WITH count(*) as total, sum(CASE WHEN docCount > 1 THEN 1 ELSE 0 END) as shared RETURN shared, total, round(100.0 * shared / total, 1) as percentShared", "suggestedFormat": "prose" }

Question: "How many chunks per document?"
{ "cypher": "MATCH (ch:Chunk) WHERE ch.documentId IN $documentIds MATCH (d:Document {id: ch.documentId}) RETURN d.filename as document, count(ch) as chunkCount ORDER BY chunkCount DESC", "suggestedFormat": "prose" }

Question: "What is the total token count across all documents?"
{ "cypher": "MATCH (d:Document) WHERE d.id IN $documentIds RETURN sum(d.totalTokens) as totalTokens", "suggestedFormat": "prose" }

Question: "How many entities of each type per document?"
{ "cypher": "MATCH (e:Entity) WHERE e.documentId IN $documentIds MATCH (d:Document {id: e.documentId}) RETURN d.filename as document, e.type as type, count(DISTINCT e) as count ORDER BY document, count DESC", "suggestedFormat": "prose" }

USER QUESTION: ${query}

Respond with JSON only: { "cypher": "...", "suggestedFormat": "prose" }`;
}

/**
 * Build a retry prompt for syntax error recovery.
 */
function buildRetryPrompt(
  query: string,
  schema: string,
  failedCypher: string,
  error: string
): string {
  return `You are a Cypher query generator for Neo4j. Your previous query had a syntax error. Fix it.

SCHEMA:
${schema}

${SECURITY_RULES}

${QUERY_RULES}

PREVIOUS ATTEMPT (FAILED):
\`\`\`cypher
${failedCypher}
\`\`\`

ERROR MESSAGE:
${error}

${CYPHER_PITFALLS}

USER QUESTION: ${query}

Fix the Cypher query. Respond with JSON only: { "cypher": "...", "suggestedFormat": "prose" }`;
}
