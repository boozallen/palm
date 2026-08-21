import { AIFactory } from '@/features/ai-provider/factory';
import { getScopedGraphSchema } from '@/features/graph-database/dal/getGraphSchema';
import { getGraphDatabaseSource } from '@/features/graph-database';
import { logger } from '@/server/logger';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import getAccessibleDocumentIds from '@/features/shared/dal/getAccessibleDocumentIds';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';
import type { GraphDatabaseSource } from '@/features/graph-database/sources/types';
import { generateCypher, type Text2CypherResult, type QueryType } from './text2Cypher';
import { validateCypherSecurity, executeCypher, isSyntaxError } from './cypherUtils';
import { filterCypherRowsForRelevance } from './filterCypherRowsForRelevance';

const MAX_RETRIES = 2;

/**
 * The graph-linking contract. Every regeneration of a node-returning query must
 * keep these columns: they pair each returned node to its id so the result can be
 * (a) tenancy-checked per cell and (b) rendered/brushed in the graph UI. The base
 * generation prompt doesn't restate it, so repair prompts re-inject it via lastError
 * — otherwise a self-correction can silently drop `_nodeId_`, and the row becomes
 * both un-checkable and un-renderable (it falls into the "no graph linking" path).
 */
const NODE_ID_CONTRACT =
  'For each node column in RETURN — any graph node, including entities, concepts, chunks, and documents — include its .id with the prefix _nodeId_ followed by the EXACT column alias (e.g. e.id AS _nodeId_source, e.name AS source). For aggregations, use collect(DISTINCT e.id) AS _nodeId_name in WITH. This is REQUIRED — do NOT drop the _nodeId_ columns when changing the query.';

/**
 * The relationship-linking contract, parallel to NODE_ID_CONTRACT. When a RETURN pairs two
 * node columns via a relationship, the relationship type is projected as `_relType_<pairAlias>`
 * so the write-time citation layer can surface a stable `[[R#]]` handle for that edge. Strictly
 * best-effort (a traversal isn't always detectable to hard-enforce) — when absent, the cited-edge
 * build resolves the actual edge between endpoints from Neo4j.
 */
const REL_TYPE_CONTRACT =
  'When a RETURN pairs two node columns via a relationship r, ALSO project its type as type(r) AS _relType_<pairAlias> (e.g. type(r) AS _relType_link alongside _nodeId_source and _nodeId_target). REQUIRED for relationship/path queries; omit for single-node and aggregation queries.';

/** Append the graph-linking contracts (`_nodeId_` + `_relType_`) to a repair instruction so
 *  regenerations keep the columns the citation/render layers key off. No-op for aggregations
 *  (they legitimately project neither). */
function withGraphLinkingReminders(error: string, queryType: QueryType): string {
  return queryType === 'aggregation'
    ? error
    : `${error} IMPORTANT — keep the graph-linking columns: ${NODE_ID_CONTRACT} ${REL_TYPE_CONTRACT}`;
}

/**
 * Re-resolve the node ids referenced by `_nodeId_*` cells against the SELECTED
 * documents and drop any row that references a node outside that set.
 *
 * Scope = the documents the user selected (`documentIds`), which is strictly a
 * subset of their accessible docs (verified at job pickup) — so this is both the
 * user's intended scope AND the tenancy floor. Free-form Cypher can return an
 * unconstrained neighbor (`MATCH (a)-[r]-(b) RETURN b.name`); this is the hard
 * boundary that catches it, complementing the (best-effort) generation prompt.
 *
 * All node cells in a row must pass (relationship rows have multiple `_nodeId_*`
 * columns — an out-of-scope endpoint drops the whole row, never a half-redaction).
 * Pure I/O: the single scoped lookup, so it unit-tests directly.
 *
 * KNOWN RESIDUAL: a bare `RETURN count(other)` over an unconstrained `other`
 * leaks a count with no node-row for this filter to drop. Mitigated at the source
 * by the generation prompt (counted/OPTIONAL-MATCH neighbors are constrained to
 * `$documentIds`); best-effort for counts, low severity within-user.
 */
export async function dropRowsOutsideDocumentScope(
  rows: Record<string, unknown>[],
  documentIds: string[],
  graphDb: GraphDatabaseSource,
): Promise<Record<string, unknown>[]> {
  const nodeIdsOf = (value: unknown): string[] =>
    Array.isArray(value) ? value.map((v) => String(v)) : [String(value)];

  const ids = [
    ...new Set(
      rows.flatMap((r) =>
        Object.entries(r)
          .filter(([k]) => k.startsWith('_nodeId_'))
          .flatMap(([, v]) => nodeIdsOf(v)),
      ),
    ),
  ];
  if (!ids.length) {
    return rows;
  }

  const res = await graphDb.run(
    'MATCH (n) WHERE n.id IN $ids AND (n.documentId IN $docs OR (n:Document AND n.id IN $docs)) RETURN n.id AS id',
    { ids, docs: documentIds },
  );
  const ok = new Set(res.records.map((r) => r.get('id') as string));

  return rows.filter((r) =>
    Object.entries(r)
      .filter(([k]) => k.startsWith('_nodeId_'))
      .every(([, v]) => nodeIdsOf(v).every((id) => ok.has(id))),
  );
}

/**
 * Hardened cypher pipeline for the agentic path. Composes the shared
 * `generateCypher` helper with a pre-execution EXPLAIN-validate → repair loop,
 * `_nodeId_` enforcement (for node-returning queries), and a per-node-cell
 * tenancy filter. Returns a `Text2CypherResult` whose `results` still carry the
 * `_nodeId_*` columns (the caller builds `nodeMapping` then strips them).
 *
 * Mirrors the history-aware repair pattern in `enumerationQuery`. EXPLAIN is run
 * via `executeCypher('EXPLAIN ' + cypher)` — the wrapper swallows the Neo4j throw
 * and surfaces it as `.error`, giving a clean validation signal (a direct
 * `graphDb.run` would re-throw). EXPLAIN catches syntax/most-schema errors, not
 * "valid but semantically wrong"; the 0-result self-correction + the agent loop
 * remain the backstop for that.
 */
export async function cypherSpecialistSearch({
  query,
  userId,
  documentIds,
  accessibleDocIds,
}: {
  query: string;
  userId: string;
  documentIds: string[];
  accessibleDocIds?: AccessibleDocIds;
}): Promise<Text2CypherResult> {
  const startTime = Date.now();
  const effectiveAccessibleDocIds = accessibleDocIds ?? (await getAccessibleDocumentIds(userId));
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

  const factory = new AIFactory({ userId });
  const { source, model } = await factory.buildKnowledgeGraphSource();
  const graphDb = await getGraphDatabaseSource();

  let lastCypher: string | undefined;
  let lastError: string | undefined;
  // Preserve the first-attempt classification across repairs.
  let lastQueryType: Text2CypherResult['queryType'] | undefined;
  let lastSuggestedFormat: Text2CypherResult['suggestedFormat'] | undefined;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      const generated = await generateCypher({
        query,
        schema,
        source,
        modelExternalId: model.externalId,
        attempt,
        lastCypher,
        lastError,
        lastQueryType,
        lastSuggestedFormat,
      });
      const cypher = generated.generatedCypher;
      const { queryType, suggestedFormat } = generated;
      lastCypher = cypher;
      lastQueryType = queryType;
      lastSuggestedFormat = suggestedFormat;

      // SECURITY: write-op + $documentIds-presence (EXPLAIN does NOT enforce scoping)
      const validation = validateCypherSecurity(cypher);
      if (!validation.valid) {
        if (attempt < MAX_RETRIES) {
          logger.warn('[CYPHER-SPECIALIST] Security validation failed, retrying', { reason: validation.reason, attempt });
          lastError = `Security validation failed: ${validation.reason}. You MUST include the WHERE ... documentId IN $documentIds filter (and use (n:Document AND n.id IN $documentIds) for Document nodes).`;
          attempt++;
          continue;
        }
        logger.warn('[CYPHER-SPECIALIST] Security validation failed after retries', { reason: validation.reason });
        return {
          query,
          generatedCypher: cypher,
          results: [],
          rowCount: 0,
          executionTimeMs: Date.now() - startTime,
          error: `Security validation failed: ${validation.reason}`,
          queryType,
          suggestedFormat,
        };
      }

      // _nodeId_ enforcement — required for node-returning queries (tenancy filter
      // + graph rendering both key off the alias↔id pairing). N/A for count-only
      // aggregations, which legitimately project no node columns.
      const lowerCypher = cypher.toLowerCase();
      if (queryType !== 'aggregation' && !lowerCypher.includes('_nodeid')) {
        if (attempt < MAX_RETRIES) {
          logger.warn('[CYPHER-SPECIALIST] Missing _nodeId in RETURN, retrying', { attempt });
          lastError = `Missing _nodeId. ${NODE_ID_CONTRACT} ${REL_TYPE_CONTRACT}`;
          attempt++;
          continue;
        }
        // Out of retries — proceed. Rows without _nodeId_ cannot be tenancy-checked,
        // but the cypher itself is $documentIds-constrained; just no graph linking.
        logger.warn('[CYPHER-SPECIALIST] Missing _nodeId after retries, proceeding without graph linking');
      }

      // _relType_ best-effort (soft, no hard retry): a node-returning query that traverses a
      // relationship but omits _relType_ leaves the cited edge un-typed. We can't reliably detect
      // every traversal to hard-enforce, so we only log — the cited-edge build falls back to
      // resolving the actual edge(s) between endpoints from Neo4j. Mirrors the _nodeId_ residual note.
      const traversesRelationship = /-\s*\[[^\]]*\]\s*->?\s*\(/.test(cypher);
      if (queryType !== 'aggregation' && traversesRelationship && !lowerCypher.includes('_reltype_')) {
        logger.warn('[CYPHER-SPECIALIST] Relationship traversal without _relType_ projection — cited edges best-effort', { queryType });
      }

      // EXPLAIN-validate before executing. executeCypher swallows the Neo4j throw
      // and reports it as .error — non-empty means the plan failed to compile.
      const explain = await executeCypher('EXPLAIN ' + cypher, { documentIds });
      if (explain.error) {
        if (attempt < MAX_RETRIES) {
          logger.warn('[CYPHER-SPECIALIST] EXPLAIN failed, repairing', { error: explain.error, attempt });
          lastError = withGraphLinkingReminders(explain.error, queryType);
          attempt++;
          continue;
        }
        logger.warn('[CYPHER-SPECIALIST] EXPLAIN failed after retries', { error: explain.error });
        return {
          query,
          generatedCypher: cypher,
          results: [],
          rowCount: 0,
          executionTimeMs: Date.now() - startTime,
          error: explain.error,
          queryType,
          suggestedFormat,
        };
      }

      logger.info('[CYPHER-SPECIALIST] EXPLAIN passed, executing', { query: query.substring(0, 50), attempt: attempt + 1 });

      const execResult = await executeCypher(cypher, { documentIds });
      if (execResult.error) {
        if (isSyntaxError(execResult.error) && attempt < MAX_RETRIES) {
          logger.warn('[CYPHER-SPECIALIST] Syntax error at execution, retrying', { error: execResult.error, attempt });
          lastError = withGraphLinkingReminders(execResult.error, queryType);
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
          queryType,
          suggestedFormat,
        };
      }

      // Self-correction: 0 results may mean over-constrained Cypher — try once more.
      if (execResult.rowCount === 0 && attempt < MAX_RETRIES) {
        logger.info('[CYPHER-SPECIALIST] 0 results, attempting self-correction', { attempt });
        lastError = withGraphLinkingReminders(
          'Query executed successfully but returned 0 results. Try a different approach (e.g. relax exact matches to CONTAINS, broaden labels).',
          queryType,
        );
        attempt++;
        continue;
      }

      // TENANCY: drop rows referencing any node outside the SELECTED documents.
      const scopedRows = await dropRowsOutsideDocumentScope(execResult.results, documentIds, graphDb);
      const droppedCount = execResult.results.length - scopedRows.length;
      if (droppedCount > 0) {
        logger.warn('[CYPHER-SPECIALIST] Dropped rows outside selected document scope', {
          droppedCount,
          keptCount: scopedRows.length,
        });
      }

      // RELEVANCE (A5): refine selective questions only. Enumeration/aggregation
      // pass through untouched (the filter also guards enumeration intent itself).
      // Runs AFTER tenancy so it never scores inaccessible rows.
      const finalRows =
        queryType === 'explanation'
          ? (await filterCypherRowsForRelevance({ subQuestion: query, rows: scopedRows, source, model })).rows
          : scopedRows;

      logger.info('[CYPHER-SPECIALIST] Query executed', {
        rowCount: finalRows.length,
        queryType,
        executionTimeMs: Date.now() - startTime,
      });

      return {
        query,
        generatedCypher: cypher,
        results: finalRows,
        rowCount: finalRows.length,
        executionTimeMs: Date.now() - startTime,
        queryType,
        suggestedFormat,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[CYPHER-SPECIALIST] Unexpected error', { error: errorMsg, attempt });
      lastError = errorMsg;
      attempt++;
    }
  }

  return {
    query,
    generatedCypher: lastCypher ?? '',
    results: [],
    rowCount: 0,
    executionTimeMs: Date.now() - startTime,
    error: lastError ?? 'Max retries exceeded',
    queryType: lastQueryType ?? 'explanation',
    suggestedFormat: lastSuggestedFormat ?? 'prose',
  };
}
