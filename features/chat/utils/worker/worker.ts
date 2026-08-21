import { Prisma } from '@prisma/client';
import { Worker, Job } from 'bullmq';
import { storage } from '@/server/storage/redis';
import logger from '@/server/logger';
import { ChatJobData } from './queue';
import { getRedisClient } from '@/server/storage/redisConnection';
import { DEFAULT_WORKER_CONFIG, WORKER_SHUTDOWN_TIMEOUT } from '@/features/ai-agents/utils/shared/types';
import { ChatCompletionMessage } from '@/features/ai-provider/sources/types';
import { MessageRole, ContextType, Citation, AsyncChatStatus, Artifact, GraphSearchResultData } from '@/features/chat/types/message';
import addContextToMessage from '@/features/chat/knowledge-bases/addContextToMessage';
import { addSystemInstructions } from '@/features/chat/utils/chatHelperFunctions';
import getMessages from '@/features/chat/dal/getMessages';
import {
  buildSystemContext,
  processDocuments,
  processKnowledgeBases,
  combineCitations,
} from '@/features/chat/utils/chatContextHelpers';
import { KBFactory } from '@/features/kb-provider';
import prisma from '@/server/db';
import { createAuditor } from '@/server/auditor';
import { UserRole } from '@/features/shared/types/user';
import {
  extractArtifactsFromMessage,
  addChatMessageIdToArtifacts,
} from '@/features/chat/utils/artifacts/artifactHelperFunctions';
import {
  extractFollowUpQuestionsFromMessage,
} from '@/features/chat/utils/followUpQuestionsHelpers';
import db from '@/server/db';
import { AIFactory } from '@/features/ai-provider/factory';
import type { ContextType as TrpcContextType } from '@/server/trpc-context';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';
import { GraphContext } from '@/features/chat/dal/buildGraphContext';
import { runAgenticChat } from '@/features/chat/services/agenticChat';
import { buildAnswerEvidenceResult } from '@/features/chat/utils/worker/buildAnswerEvidenceResult';
import { extractGraphCitationsFromMessage, type CitedEdge } from '@/features/chat/utils/graphCitationHelpers';
import { warmInferenceCache } from '@/pages/api/internal/inference-with-tools';
import { classifyQuery } from '@/features/graph-database/services/queryRouter';
import { getScopedGraphSchema } from '@/features/graph-database/dal/getGraphSchema';
import { enumerationQuery } from '@/features/graph-database/services/enumerationQuery';
import { aggregationQuery } from '@/features/graph-database/services/aggregationQuery';
import { explanationQuery } from '@/features/graph-database/services/explanationQuery';
import { processText2CypherResult } from '@/features/chat/services/resultProcessor';
import { buildNodeMapping } from '@/features/graph-database/services/buildNodeMapping';
import { enqueueConversationGraphSync } from '@/features/graph-database/utils/worker/conversationGraphQueue';
import { isMemoryEnabled } from '@/features/graph-database/utils/isMemoryEnabled';

let worker: Worker | null = null;
let shutdownInProgress = false;

// Maximum number of messages that will be used to generate the completion
const maxExistingMessages = -24;

/**
 * Internal metadata fields that should never be shown to users.
 */
const INTERNAL_METADATA_FIELDS = new Set([
  'id', 'documentid', 'userid', 'embeddingid', 'chunkid', 'graphid',
  'createdat', 'updatedat', 'graphextractedat',
  'status', 'totalchunks', 'totaltokens', 'chunkindex', 'startposition', 'endposition',
  'chunkcount', 'tokencount', 'createddate', 'updateddate',
  'graphextracted', 'processed',
]);

const INTERNAL_METADATA_PATTERNS = [
  /^_/, /id$/i, /at$/i, /date$/i, /^chunk/i, /^token/i, /^total(?!$)/i,
];

function stripInternalMetadata(results: Record<string, unknown>[]): Record<string, unknown>[] {
  return results.map(row => {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const keyLower = key.toLowerCase();
      if (INTERNAL_METADATA_FIELDS.has(keyLower)) {
        continue;
      }
      if (INTERNAL_METADATA_PATTERNS.some(pattern => pattern.test(key))) {
        continue;
      }
      clean[key] = value;
    }
    return clean;
  });
}

type GraphData = NonNullable<GraphSearchResultData['graphData']>;

const toNumber = (val: any): number => {
  if (val === null || val === undefined) {return 0;}
  if (typeof val === 'object' && val.toNumber) {return val.toNumber();}
  return parseInt(val.toString(), 10);
};

function transformGraphContextToCitations(graphContext?: GraphContext): Citation[] {
  if (!graphContext) {
    return [];
  }

  const entityCitations: Citation[] = graphContext.entities.map((e) => ({
    contextType: ContextType.GRAPH_ENTITY,
    graphEntityId: e.id,
    sourceLabel: e.entityName,
    citation: e.description || e.entityName,
    description: e.description,
    aliases: e.aliases,
  }));

  const conceptCitations: Citation[] = graphContext.concepts.map((c) => ({
    contextType: ContextType.GRAPH_CONCEPT,
    graphConceptId: c.id,
    sourceLabel: c.conceptName,
    citation: c.description || c.conceptName,
    description: c.description,
    category: c.category,
  }));

  return [...entityCitations, ...conceptCitations];
}

/**
 * Shared transform: Neo4j node/edge records → the `graphData` render shape. Node records expose
 * `anchorNeoId`/`anchorLabels`/`anchorProps`; edge records expose `rFromNeoId`/`rToNeoId`/`rType`/
 * `rProps`. Edges are deduped by (sorted endpoints, type).
 */
function buildGraphDataFromRecords(
  nodesResult: { records: any[] },
  edgesResult: { records: any[] },
): GraphData {
  const nodes = nodesResult.records.map((record: any) => {
    const neoId = toNumber(record.get('anchorNeoId'));
    const labels = record.get('anchorLabels') as string[];
    const props = record.get('anchorProps') as Record<string, any>;
    const primaryLabel = labels?.[0] || 'Node';
    return {
      id: neoId,
      label: props?.name || props?.title || `${primaryLabel}-${neoId}`,
      labels: labels || [],
      properties: props || {},
      group: primaryLabel,
      isAnchor: true,
    };
  });

  const edgesMap = new Map<string, any>();
  for (const record of edgesResult.records) {
    const fromId = toNumber(record.get('rFromNeoId'));
    const toId = toNumber(record.get('rToNeoId'));
    const rType = record.get('rType') as string;
    const sortedIds = [fromId, toId].sort((a, b) => a - b);
    const key = `${sortedIds[0]}-${rType}-${sortedIds[1]}`;
    if (!edgesMap.has(key)) {
      edgesMap.set(key, {
        from: fromId,
        to: toId,
        label: rType || 'RELATED',
        type: rType || 'RELATED',
        properties: record.get('rProps') || {},
        isShortestPath: false,
      });
    }
  }

  return { nodes, edges: Array.from(edgesMap.values()) };
}

// Fetch every node in $anchorIds (tenancy-scoped). Shared by the enumeration and cited-evidence
// fetchers.
const ANCHOR_NODES_QUERY = `
  MATCH (anchor)
  WHERE anchor.id IN $anchorIds
    AND (anchor.documentId IN $accessibleDocIds OR (anchor:Document AND anchor.id IN $accessibleDocIds))
  RETURN anchor, labels(anchor) as anchorLabels,
    id(anchor) as anchorNeoId, properties(anchor) as anchorProps
`;

// Every (non-IDENTITY) edge BETWEEN nodes in $anchorIds. The induced subgraph over a node set —
// used by enumeration, and as the cited-evidence edge floor when the answer cites no edges.
const INDUCED_EDGES_QUERY = `
  MATCH (a1)-[r]-(a2)
  WHERE a1.id IN $anchorIds AND a2.id IN $anchorIds
    AND (a1.documentId IN $accessibleDocIds OR (a1:Document AND a1.id IN $accessibleDocIds))
    AND (a2.documentId IN $accessibleDocIds OR (a2:Document AND a2.id IN $accessibleDocIds))
    AND a1.id < a2.id AND type(r) <> 'IDENTITY'
  RETURN DISTINCT type(r) as rType, properties(r) as rProps,
    id(startNode(r)) as rFromNeoId, id(endNode(r)) as rToNeoId
`;

/**
 * Pre-fetch graph visualization data (nodes + inter-edges) for enumeration results.
 * Called at enumeration time so the frontend can render the graph instantly on row selection.
 */
async function fetchEnumerationGraphData(
  entityIds: string[],
  accessibleDocIds: AccessibleDocIds,
): Promise<GraphSearchResultData['graphData']> {
  const { getGraphDatabaseSource } = await import('@/features/graph-database');

  const graphDb = await getGraphDatabaseSource();
  const accessibleDocIdsArr = Array.from(accessibleDocIds);
  const params = { accessibleDocIds: accessibleDocIdsArr, anchorIds: entityIds };

  const [nodesResult, edgesResult] = await Promise.all([
    graphDb.run(ANCHOR_NODES_QUERY, params),
    graphDb.run(INDUCED_EDGES_QUERY, params).catch((err: any) => {
      logger.warn('[CHAT] Enumeration graph inter-edges query failed', { error: err.message });
      return { records: [] };
    }),
  ]);

  const graphData = buildGraphDataFromRecords(nodesResult, edgesResult);

  logger.info('[CHAT] Enumeration graph data pre-fetched', {
    entityCount: entityIds.length,
    nodeCount: graphData.nodes.length,
    edgeCount: graphData.edges.length,
  });

  return graphData;
}

/**
 * Fetch the write-time "evidence" subgraph for the cited nodes, with TWO-TIER edges:
 *
 *  - Precision tier (when the answer cites edges): match each cited `(src, type, tgt)` triple
 *    exactly — the specific relationships the answer asserts.
 *  - Floor tier (when it cites none — common for broad/aggregated/oversized queries where per-edge
 *    rows are never citable): induce the edges that exist AMONG the cited node set. Bounded by the
 *    tight cited-node set, so it's a relevant connection map, NOT the old induced-subgraph hairball.
 *
 * The floor fires only when the precision tier returns zero edges, so it never dilutes a precise
 * citation.
 */
async function fetchCitedEvidenceGraph(
  nodeIds: string[],
  edges: CitedEdge[],
  accessibleDocIds: AccessibleDocIds,
): Promise<GraphSearchResultData['graphData']> {
  const { getGraphDatabaseSource } = await import('@/features/graph-database');

  const graphDb = await getGraphDatabaseSource();
  const accessibleDocIdsArr = Array.from(accessibleDocIds);

  const citedEdgesQuery = `
    UNWIND $edges AS e
    MATCH (a {id: e.src})-[r]-(b {id: e.tgt})
    WHERE type(r) = e.type
      AND (a.documentId IN $accessibleDocIds OR (a:Document AND a.id IN $accessibleDocIds))
      AND (b.documentId IN $accessibleDocIds OR (b:Document AND b.id IN $accessibleDocIds))
    RETURN DISTINCT id(startNode(r)) as rFromNeoId, id(endNode(r)) as rToNeoId,
      type(r) as rType, properties(r) as rProps
  `;

  const edgeParams = edges.map((e) => ({ src: e.src, type: e.relType, tgt: e.tgt }));
  const params = { accessibleDocIds: accessibleDocIdsArr, anchorIds: nodeIds, edges: edgeParams };

  const [nodesResult, citedEdgesResult] = await Promise.all([
    graphDb.run(ANCHOR_NODES_QUERY, params),
    edgeParams.length > 0
      ? graphDb.run(citedEdgesQuery, params).catch((err: any) => {
          logger.warn('[CHAT] Cited-evidence edges query failed', { error: err.message });
          return { records: [] };
        })
      : Promise.resolve({ records: [] }),
  ]);

  const graphData = buildGraphDataFromRecords(nodesResult, citedEdgesResult);

  // Floor tier: the answer cited no resolvable edges but named ≥2 entities — induce the edges
  // among exactly those cited nodes so a connection question still renders relationships.
  let usedFloor = false;
  if (graphData.edges.length === 0 && graphData.nodes.length >= 2) {
    const inducedResult = await graphDb.run(INDUCED_EDGES_QUERY, params).catch((err: any) => {
      logger.warn('[CHAT] Cited-evidence induced-edge floor query failed', { error: err.message });
      return { records: [] };
    });
    graphData.edges = buildGraphDataFromRecords({ records: [] }, inducedResult).edges;
    usedFloor = true;
  }

  logger.info('[CHAT] Cited-evidence graph data fetched', {
    citedNodeCount: nodeIds.length,
    citedEdgeCount: edges.length,
    nodeCount: graphData.nodes.length,
    edgeCount: graphData.edges.length,
    edgeTier: usedFloor ? 'induced-floor' : 'cited-precision',
  });

  return graphData;
}

const shutdown = async (signal: string): Promise<void> => {
  if (shutdownInProgress) {
    return;
  }

  shutdownInProgress = true;
  logger.info(`[CHAT] ${signal} received, shutting down Chat worker...`);

  try {
    await storage.del('worker:chat:running');

    if (worker) {
      const forceShutdownTimeout = setTimeout(() => {
        logger.warn('[CHAT] Force shutting down Chat worker after timeout');
        throw new Error('Force Chat worker shutdown due to timeout');
      }, WORKER_SHUTDOWN_TIMEOUT);

      await worker.close();
      clearTimeout(forceShutdownTimeout);
      logger.info('[CHAT] Chat worker closed successfully');
    }
  } catch (error) {
    logger.error('[CHAT] Error shutting down Chat worker:', error);
    throw error;
  }
};

export const startChatWorker = async (): Promise<void> => {
  let connection;

  try {
    connection = getRedisClient();
  } catch {
    logger.info('[CHAT] Redis not available — skipping Chat worker startup.');
    return;
  }

  if (!storage) {
    logger.warn('[CHAT] Storage is not enabled, skipping Chat worker startup.');
    return;
  }

  if (worker?.isRunning()) {
    logger.info('[CHAT] Chat worker is already running, skipping initialization');
    return;
  }

  worker = new Worker<ChatJobData>(
    'chat-jobs',
    processChatJob,
    {
      connection,
      lockDuration: 1800000,   // 30 min — matches httpx timeout in langgraph tools.py
      stalledInterval: 900000, // 15 min — must be < lockDuration to avoid false stall detection
      maxStalledCount: 1,
      concurrency: DEFAULT_WORKER_CONFIG.concurrency,
      limiter: DEFAULT_WORKER_CONFIG.limiter,
    }
  );

  worker.on('completed', (job) => {
    logger.info(`[CHAT] Chat job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`[CHAT] Chat job ${job?.id} failed:`, err);
  });

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.info('[CHAT] Chat worker started successfully');
};

export async function processChatJob(job: Job<ChatJobData>): Promise<{ success: boolean }> {
      const {
        jobId,
        userId,
        chatId,
        messageId,
        modelId,
        originalUserMessage,
        knowledgeBaseIds,
        citations: initialCitations,
        useAgenticChat,
        useGraph,
        graphEntityIds,
        graphScopeSource,
      } = job.data;
      let documentIds = job.data.documentIds;

      try {
        logger.info(`[CHAT] Processing chat job ${jobId} for user ${userId}`);

        const setProgress = async (message: string) => {
          await Promise.all([
            storage.hset(`chat-job:${jobId}`, { progress: message, last_updated: Date.now() }),
            storage.rpush(`chat-job-progress:${jobId}`, message),
          ]);
        };

        await storage.hset(`chat-job:${jobId}`, {
          status: 'processing',
          progress: 'Preparing chat completion...',
          created: Date.now(),
        });
        await storage.rpush(`chat-job-progress:${jobId}`, 'Preparing chat completion...');

        // Create context for KB operations
        const kb = new KBFactory({ userId });
        const auditor = createAuditor({ userId, referer: undefined });
        const workerLogger = logger.child({ userId });
        const { default: getAccessibleDocumentIdsForCtx } = await import('@/features/shared/dal/getAccessibleDocumentIds');
        let ctxAccessibleDocIdsCache: AccessibleDocIds | undefined;
        const ctx: TrpcContextType = {
          userId,
          userRole: UserRole.User,
          prisma,
          logger: workerLogger,
          auditor,
          ai: new (await import('@/features/ai-provider')).AIFactory({ userId }),
          kb,
          getAccessibleDocIds: async () => {
            if (!ctxAccessibleDocIdsCache) {
              ctxAccessibleDocIdsCache = await getAccessibleDocumentIdsForCtx(userId);
            }
            return ctxAccessibleDocIdsCache;
          },
        };

        // Silent fail-closed re-check: a doc that was accessible at route entry may
        // no longer be accessible by the time the worker picks up the job (group
        // membership revoked, doc deleted, etc.). Filter rather than throw — the
        // route already returned 200 to the user.
        const accessibleDocIds = await ctx.getAccessibleDocIds();
        const inaccessibleAtPickup = documentIds.filter((id) => !accessibleDocIds.has(id));
        if (inaccessibleAtPickup.length > 0) {
          workerLogger.warn('[CHAT-WORKER] Pre-queued job references inaccessible docs; silently filtering', {
            userId,
            jobId,
            requestedCount: documentIds.length,
            inaccessibleCount: inaccessibleAtPickup.length,
          });
          documentIds = documentIds.filter((id) => accessibleDocIds.has(id));
        }

        let documentLibraryCitations: Citation[] = [];
        let agenticGraphSearchResults: GraphSearchResultData[] | undefined;
        let graphSearchResultLabel: string | undefined;
        let finalText = '';
        let artifacts: Artifact[] = [];
        let followUpQuestions: string[] = [];
        let graphSearchResult: GraphSearchResultData | undefined;

        // Process knowledge bases first (always the same regardless of retrieval method)
        const existingKbCitations: Citation[] = [...initialCitations.filter(c => c.contextType === ContextType.KNOWLEDGE_BASE)];
        let additionalKbCitations: Citation[] = [];

        if (knowledgeBaseIds.length && existingKbCitations.length === 0) {
          logger.info(`[CHAT] Processing ${knowledgeBaseIds.length} knowledge bases`);
          await setProgress('Retrieving knowledge base content...');

          const kbResults = await processKnowledgeBases(ctx, originalUserMessage, knowledgeBaseIds);
          additionalKbCitations = kbResults.citations;
        }

        if (useAgenticChat) {
          // ---------------------------------------------------------------
          // Agentic path: LangGraph + MCP tools
          // ---------------------------------------------------------------
          const msgs = await getMessages(chatId);
          const historyMsgs = msgs.filter((msg) =>
            msg.id !== messageId &&
            msg.asyncChatStatus !== AsyncChatStatus.PROCESSING &&
            msg.content.trim() !== '',
          );
          const lastHistoryMsg = historyMsgs.at(-1);
          if (
            lastHistoryMsg &&
            lastHistoryMsg.role === MessageRole.User &&
            lastHistoryMsg.content === originalUserMessage
          ) {
            historyMsgs.pop();
          }

          const agentMessages: ChatCompletionMessage[] = historyMsgs
            .slice(maxExistingMessages)
            .flatMap((msg): ChatCompletionMessage[] => {
              if (msg.role !== MessageRole.Assistant) {
                return [{ role: msg.role, content: msg.content }];
              }
              // Drop orphaned placeholder messages from previous failed runs.
              if (/^\[Artifact generated:|^✅ system:artifact-delivered/i.test(msg.content.trim())) {
                return [];
              }
              // Replace synthesis prose for artifact-producing turns so the model sees a
              // neutral summary in history and cannot imitate the text instead of calling an artifact tool.
              if (msg.artifacts && msg.artifacts.length > 0) {
                const labels = msg.artifacts.map((a) => a.label).join(', ');
                return [{ role: msg.role, content: `Generated: ${labels}.` }];
              }
              return [{ role: msg.role, content: msg.content }];
            });

          agentMessages.push({ role: MessageRole.User, content: originalUserMessage });

          // Inject the scoped graph schema up front (graph mode only) so the agent
          // knows what's queryable from turn 1 and cypher_query is usable immediately
          // — no get_schema round-trip. Scoped to the selected docs (∩ accessible).
          const graphSchema = useGraph
            ? await getScopedGraphSchema(accessibleDocIds, documentIds)
            : '';

          await warmInferenceCache(userId, modelId);

          const recentEditableArtifacts = await db.chatArtifact.findMany({
            where: {
              fileExtension: { in: ['.docx', '.xlsx', '.pptx'] },
              message: { chatId },
              // Include .docx even without a sourceScript — edit_docx handles that case
              // gracefully. .xlsx/.pptx require a script to be editable.
              OR: [
                { fileExtension: '.docx' },
                { fileExtension: '.xlsx', NOT: { sourceScript: null } },
                { fileExtension: '.pptx', NOT: { sourceScript: null } },
              ],
            },
            orderBy: { createdAt: 'desc' },
            select: { label: true, fileExtension: true, sourceScript: true },
          });
          // Most-recent entry per label across all editable artifact types.
          // .docx entries may have an empty script (pre-unification artifacts) — the
          // edit_docx tool handles that case by falling back to a graceful error.
          const artifactScriptMap: Record<string, { ext: string; script: string }> = {};
          for (const a of recentEditableArtifacts) {
            if (!(a.label in artifactScriptMap)) {
              artifactScriptMap[a.label] = { ext: a.fileExtension, script: a.sourceScript ?? '' };
            }
          }

          // Write-time evidence citation: on whenever this turn is in graph mode. Drives both the
          // agent's citation prompt (via the service) and the end-of-turn evidence-graph build.
          const evidenceMode = useGraph;

          const skillRepoCount = await db.gitHubProvider.count({
            where: {
              isSkillRepo: true,
              deletedAt: null,
              userGroups: { some: { userGroupMemberships: { some: { userId } } } },
            },
          });

          const agentResult = await runAgenticChat({
            userId,
            modelId,
            chatId,
            messageId,
            documentIds,
            messages: agentMessages,
            jobId,
            useGraph,
            graphSchema,
            citeEvidence: evidenceMode,
            artifactScriptMap,
            hasSkillRepos: skillRepoCount > 0,
          });

          documentLibraryCitations = agentResult.citations;
          finalText = agentResult.finalText;
          const { artifacts: extractedArtifacts, cleanedText: afterArtifacts } = extractArtifactsFromMessage(finalText);
          const { followUpQuestions: extractedFollowUps, cleanedText: afterFollowUps } = extractFollowUpQuestionsFromMessage(afterArtifacts);
          // Write-time citations: resolve the cited [[E#]]/[[R#]]/[[Q#]] handles to node ids, edge
          // triples, and whole-retrieval indices, and strip the markers so the displayed/persisted
          // answer is clean. A handle missing from handleMap is dropped (no synthetic ids); a
          // marker-free answer (non-graph mode, or no graph claim) yields empty citations and the
          // legacy union path below.
          const { citedNodeIds, citedEdges, citedQueryIndices, cleanedText: citationCleanedText } =
            extractGraphCitationsFromMessage(afterFollowUps, agentResult.handleMap);
          // Keep the MARKED answer text (markers still in place) + the handle map so the render can
          // reconnect each inline citation to its graph element. `finalText`/`content` below stay
          // clean (stripped); these ride along on the evidence entry only (see attach below).
          const citedText = afterFollowUps;
          const citationHandleMap = agentResult.handleMap;
          artifacts = extractedArtifacts.map((a) => ({
            ...a,
            sourceScript: agentResult.artifactScriptMap[a.label]?.script ?? null,
          }));
          followUpQuestions = extractedFollowUps;
          finalText = citationCleanedText;
          addChatMessageIdToArtifacts(artifacts, messageId);

          // Query-level citation expansion: a cited [[Q#]] designates an ENTIRE retrieval as the
          // answer. Union that retrieval's full server-side nodeMapping/edgeMapping — which the
          // worker holds even when the agent's row view was capped — into the same cited sets the
          // element-level [[E#]]/[[R#]] handles feed. This is bulk [[E#]]/[[R#]]: the downstream
          // evidence build is unchanged, it just receives more ids/edges. Out-of-range / garbled
          // indices are dropped (no synthetic ids).
          const evidenceNodeIdSet = new Set<string>(citedNodeIds);
          const evidenceEdges: CitedEdge[] = [];
          const evidenceEdgeKeys = new Set<string>();
          const pushEvidenceEdge = (e: CitedEdge): void => {
            const key = `${e.src}|${e.relType}|${e.tgt}`;
            if (!evidenceEdgeKeys.has(key)) {
              evidenceEdgeKeys.add(key);
              evidenceEdges.push(e);
            }
          };
          for (const e of citedEdges) {
            pushEvidenceEdge(e);
          }
          for (const qi of citedQueryIndices) {
            const cited = agentResult.graphSearchResults[qi];
            if (!cited) {
              continue; // out-of-range / garbled index — drop, never synthesize
            }
            for (const m of cited.nodeMapping) {
              for (const id of m.entityIds) {
                if (id) {
                  evidenceNodeIdSet.add(id);
                }
              }
            }
            for (const e of cited.edgeMapping ?? []) {
              pushEvidenceEdge({ src: e.src, relType: e.relType, tgt: e.tgt });
            }
          }
          const evidenceNodeIds = [...evidenceNodeIdSet];

          // End-of-turn graph assembly. Two modes:
          //
          // (A) Answer-evidence (graph mode + the answer cited ≥1 resolvable handle, element-level
          //     [[E#]]/[[R#]] OR a whole-retrieval [[Q#]]): build ONE "evidence" subgraph from the
          //     expanded cited nodes + cited edges and demote the raw per-query results to
          //     table-only "exploration" entries. This is a tight, edge-grounded map — not the
          //     union over every collected entity id.
          //
          // (B) Legacy (no citations, or evidence build failed): build the heavy graphData ONCE over
          //     every entity id collected across this turn's cypher calls and attach it to each
          //     payload — the fallback when no edge-grounded evidence subgraph could be assembled.
          if (agentResult.graphSearchResults.length > 0) {
            let evidenceEntry: GraphSearchResultData | null = null;
            if (evidenceMode && evidenceNodeIds.length > 0) {
              try {
                evidenceEntry = await buildAnswerEvidenceResult(
                  evidenceNodeIds,
                  evidenceEdges,
                  accessibleDocIds,
                  fetchCitedEvidenceGraph,
                );
              } catch (err) {
                logger.warn('[CHAT] Failed to build answer-evidence graph', { error: (err as Error).message });
              }
            }

            if (evidenceEntry) {
              // Persist the citation → graph link on the evidence entry (JSON column, no migration):
              // the marked answer text + the handle map. The render uses these to turn each inline
              // [[E#]]/[[R#]] into an anchor that highlights its cited node(s)/edge(s) on the canvas.
              evidenceEntry.citedText = citedText;
              evidenceEntry.handleMap = citationHandleMap;
              // (A) Evidence-first: the cited subgraph drives the canvas; exploration is table-only.
              const exploration = agentResult.graphSearchResults.map((p) => ({ ...p, kind: 'exploration' as const }));
              agenticGraphSearchResults = [evidenceEntry, ...exploration];
              graphSearchResultLabel = `Answer evidence (${evidenceEntry.rowCount} ${evidenceEntry.rowCount === 1 ? 'node' : 'nodes'})`;
              logger.info('[CHAT] Assembled answer-evidence graph', {
                evidenceNodeCount: evidenceEntry.rowCount,
                evidenceEdgeCount: evidenceEntry.graphData?.edges.length ?? 0,
                citedEdgeCount: evidenceEdges.length,
                citedQueryCount: citedQueryIndices.length,
                explorationCount: exploration.length,
              });
            } else {
              // (B) Legacy union fetch — verbatim prior behavior (flag-off regression guard).
              const allEntityIds = [
                ...new Set(
                  agentResult.graphSearchResults.flatMap((p) => p.nodeMapping.flatMap((m) => m.entityIds)),
                ),
              ];
              let graphData: GraphSearchResultData['graphData'] | undefined;
              if (allEntityIds.length > 0) {
                try {
                  graphData = await fetchEnumerationGraphData(allEntityIds, accessibleDocIds);
                } catch (err) {
                  logger.warn('[CHAT] Failed to pre-fetch agentic graph data', { error: (err as Error).message });
                }
              }
              agenticGraphSearchResults = agentResult.graphSearchResults.map((p) => ({ ...p, graphData }));
              graphSearchResultLabel = `Graph Results (${agenticGraphSearchResults.length} ${agenticGraphSearchResults.length === 1 ? 'query' : 'queries'})`;
              logger.info('[CHAT] Assembled agentic graph search results', {
                resultCount: agenticGraphSearchResults.length,
                entityCount: allEntityIds.length,
              });
            }
          }

        } else {
          // ---------------------------------------------------------------
          // Non-agentic path: query router + direct LLM call
          // ---------------------------------------------------------------
          const systemContext = await buildSystemContext(userId, knowledgeBaseIds, documentIds);
          const { userKnowledgeBases, selectedKnowledgeBases, hasDocumentLibrary, documentsWithSelectionState } = systemContext;

          let graphContext: GraphContext | undefined;
          let structuredResultsSections: string[] = [];

          if (useGraph && documentIds.length > 0) {
            logger.info('[CHAT] Using query router for graph-enhanced retrieval', {
              documentCount: documentIds.length,
              useGraph,
              graphScopeSource: graphScopeSource || 'none',
              graphEntityIdCount: graphEntityIds?.length ?? 0,
            });

            await setProgress('Classifying query...');

            const classification = await classifyQuery(originalUserMessage, userId, documentIds);
            logger.info('[CHAT] Query classified', {
              confidences: classification.confidences,
              activeTypes: classification.activeTypes,
              primaryType: classification.primaryType,
            });

            let needsExplanationFallback = false;

            if (classification.activeTypes.includes('enumeration')) {
              await setProgress('Running enumeration query...');

              if (graphEntityIds?.length) {
                logger.info('[CHAT] Graph-scoped enumeration', { graphEntityIdCount: graphEntityIds.length });
              }

              const result = await enumerationQuery({
                query: originalUserMessage,
                documentIds,
                userId,
                graphEntityIds: graphEntityIds?.length ? graphEntityIds : undefined,
              });

              if (result.error || result.rowCount === 0) {
                logger.warn('[CHAT] Enumeration returned no results', {
                  error: result.error,
                  rowCount: result.rowCount,
                });
                if (classification.activeTypes.length === 1) {
                  needsExplanationFallback = true;
                }
              } else {
                const nodeMapping = buildNodeMapping(result.results);
                const cleanResults = stripInternalMetadata(result.results);
                const cleanResult = { ...result, results: cleanResults, query: originalUserMessage };
                const processed = processText2CypherResult(cleanResult);
                if (processed.context) {
                  structuredResultsSections.push(
                    'IMPORTANT: Do NOT create any artifacts (no code blocks, no tables, no files) for these query results. The complete dataset is already displayed to the user in an interactive table with filtering and selection. Just provide a brief summary.\n\n' +
                    processed.context,
                  );
                }

                if (nodeMapping.length > 0) {
                  const allEntityIds = [...new Set(nodeMapping.flatMap((m) => m.entityIds))];
                  let graphData: GraphSearchResultData['graphData'] | undefined;
                  if (allEntityIds.length > 0) {
                    try {
                      graphData = await fetchEnumerationGraphData(allEntityIds, accessibleDocIds);
                    } catch (err) {
                      logger.warn('[CHAT] Failed to pre-fetch enumeration graph data', { error: (err as Error).message });
                    }
                  }

                  graphSearchResult = {
                    rows: cleanResults,
                    nodeMapping,
                    query: originalUserMessage,
                    rowCount: result.rowCount,
                    generatedCypher: result.generatedCypher,
                    graphData,
                  };
                  graphSearchResultLabel = `Graph Results (${result.rowCount} rows)`;
                }
              }
            }

            if (classification.activeTypes.includes('aggregation')) {
              await setProgress('Running aggregation query...');

              const result = await aggregationQuery({
                query: originalUserMessage,
                documentIds,
                userId,
              });

              if (result.error || result.rowCount === 0) {
                logger.warn('[CHAT] Aggregation returned no results', {
                  error: result.error,
                  rowCount: result.rowCount,
                });
                if (classification.activeTypes.length === 1) {
                  needsExplanationFallback = true;
                }
              } else {
                const cleanResults = stripInternalMetadata(result.results);
                structuredResultsSections.push(`### Statistics\n\n\`\`\`json\n${JSON.stringify(cleanResults, null, 2)}\n\`\`\``);
              }
            }

            if (classification.activeTypes.includes('explanation') || needsExplanationFallback) {
              await setProgress('Running semantic search...');

              const result = await explanationQuery({
                query: originalUserMessage,
                documentIds,
                userId,
                graphEntityIds: graphEntityIds?.length ? graphEntityIds : undefined,
              });
              documentLibraryCitations = result.citations;
              graphContext = result.graphContext;

              logger.info('[CHAT] Explanation query completed', {
                citationCount: documentLibraryCitations.length,
                hasGraphContext: !!graphContext,
              });

              if (graphContext && !graphSearchResult) {
                const explanationRows: Record<string, unknown>[] = [];
                const explanationNodeMapping: { rowIndex: number; entityIds: string[] }[] = [];
                let rowIdx = 0;

                for (const entity of graphContext.entities) {
                  explanationRows.push({
                    Name: entity.entityName,
                    Type: 'Entity',
                    Category: '',
                    Description: entity.description || '',
                    Score: Number(entity.score?.toFixed(3)) || 0,
                  });
                  explanationNodeMapping.push({ rowIndex: rowIdx, entityIds: [entity.id] });
                  rowIdx++;
                }

                for (const concept of graphContext.concepts) {
                  explanationRows.push({
                    Name: concept.conceptName,
                    Type: 'Concept',
                    Category: concept.category || '',
                    Description: concept.description || '',
                    Score: Number(concept.score?.toFixed(3)) || 0,
                  });
                  explanationNodeMapping.push({ rowIndex: rowIdx, entityIds: [concept.id] });
                  rowIdx++;
                }

                if (explanationRows.length > 0) {
                  let explanationGraphData: GraphSearchResultData['graphData'] | undefined;
                  const allExplanationIds = explanationNodeMapping.flatMap((m) => m.entityIds);
                  try {
                    explanationGraphData = await fetchEnumerationGraphData(allExplanationIds, accessibleDocIds);
                  } catch (err) {
                    logger.warn('[CHAT] Failed to pre-fetch explanation graph data', { error: (err as Error).message });
                  }

                  graphSearchResult = {
                    rows: explanationRows,
                    nodeMapping: explanationNodeMapping,
                    query: originalUserMessage,
                    rowCount: explanationRows.length,
                    generatedCypher: '',
                    graphData: explanationGraphData,
                  };
                  graphSearchResultLabel = `Semantic Results (${explanationRows.length} matches)`;
                }
              }
            }

          } else if (documentIds.length > 0) {
            logger.info(`[CHAT] Processing ${documentIds.length} documents for embeddings`);
            await setProgress('Embedding documents...');

            const processResult = await processDocuments(
              originalUserMessage,
              userId,
              documentIds,
              false,
              useGraph,
              { chatMessageId: messageId, stepLabel: 'query embedding' },
            );
            documentLibraryCitations = processResult.citations;
            graphContext = processResult.graphContext;
            logger.info(`[CHAT] Retrieved ${documentLibraryCitations.length} document embeddings`);
          }

          const graphCitations = useGraph && graphContext
            ? transformGraphContextToCitations(graphContext)
            : [];

          const baseCitations = combineCitations(
            documentLibraryCitations,
            [...existingKbCitations, ...additionalKbCitations],
          );
          const allNonAgenticCitations = [...baseCitations, ...graphCitations];

          let messageWithContext = addContextToMessage(originalUserMessage, baseCitations, useGraph, graphContext);

          if (structuredResultsSections.length > 0) {
            const structuredContext = structuredResultsSections.join('\n\n---\n\n');
            messageWithContext += `\n\n## Text2Cypher Results:\n\n${structuredContext}`;
          }

          if (useGraph && messageWithContext !== originalUserMessage) {
            messageWithContext += '\n\n## Rules:\n1. Ground your answer in the retrieved context above. Do not state facts that are not supported by the provided data.\n2. Reference entities and relationships by their actual names from the context.\n3. If you supplement with additional information beyond the retrieved context, you must state that it is outside the context provided.\n4. If the retrieved context does not contain enough information to fully answer the question, say so rather than filling in details.';
          }

          const msgs = await getMessages(chatId);
          const historyMsgs = msgs.filter((msg) =>
            msg.id !== messageId &&
            msg.asyncChatStatus !== AsyncChatStatus.PROCESSING &&
            msg.content.trim() !== '',
          );
          const lastHistoryMsg = historyMsgs.at(-1);
          if (
            lastHistoryMsg &&
            lastHistoryMsg.role === MessageRole.User &&
            lastHistoryMsg.content === originalUserMessage
          ) {
            historyMsgs.pop();
          }

          const messages: ChatCompletionMessage[] = historyMsgs
            .slice(maxExistingMessages)
            .map((msg) => ({
              role: msg.role,
              content: msg.content,
              artifacts: msg.artifacts,
            }));

          messages.push({ role: MessageRole.User, content: messageWithContext });

          messages[0].content = addSystemInstructions(
            messages[0].content,
            userKnowledgeBases,
            selectedKnowledgeBases,
            hasDocumentLibrary,
            documentsWithSelectionState,
          );

          await setProgress('Generating response...');

          const aiFactory = new AIFactory({ userId });
          const ai = await aiFactory.buildUserSource(modelId, {
            attribution: { chatMessageId: messageId, stepLabel: 'response' },
          });
          const assistantMessage = await ai.source.chatCompletion(messages, {
            model: ai.model.externalId,
            temperature: 0.2,
            topP: 0.5,
          });

          const { artifacts: extractedArtifacts, cleanedText } = extractArtifactsFromMessage(assistantMessage.text);
          const { followUpQuestions: extractedFollowUps, cleanedText: finalCleanedText } = extractFollowUpQuestionsFromMessage(cleanedText);
          artifacts = extractedArtifacts;
          followUpQuestions = extractedFollowUps;
          finalText = finalCleanedText;
          addChatMessageIdToArtifacts(artifacts, messageId);

          documentLibraryCitations = allNonAgenticCitations;
        }

        // Combine all citations — for the agentic path documentLibraryCitations already
        // contains only doc/graph citations; for the non-agentic path it contains
        // everything including KB citations, so KB args are empty to avoid double-counting.
        const allCitations = useAgenticChat
          ? combineCitations(documentLibraryCitations, [...existingKbCitations, ...additionalKbCitations])
          : documentLibraryCitations;

        // Build citation data outside transaction so it's available for fallback
        const persistableCitations = allCitations.filter(
          c => c.contextType === ContextType.DOCUMENT_LIBRARY ||
               c.contextType === ContextType.KNOWLEDGE_BASE ||
               c.contextType === ContextType.GRAPH_ENTITY ||
               c.contextType === ContextType.GRAPH_CONCEPT
        );
        const citationData = persistableCitations.map((citation) => {
          switch (citation.contextType) {
            case ContextType.DOCUMENT_LIBRARY:
              return {
                chatMessageId: messageId,
                documentId: citation.documentId,
                embeddingId: citation.embeddingId,
                citation: citation.citation,
              };
            case ContextType.KNOWLEDGE_BASE:
              return {
                chatMessageId: messageId,
                knowledgeBaseId: citation.knowledgeBaseId,
                citation: citation.citation,
              };
            case ContextType.GRAPH_ENTITY:
              return {
                chatMessageId: messageId,
                graphEntityId: citation.graphEntityId,
                citation: citation.citation,
              };
            case ContextType.GRAPH_CONCEPT:
              return {
                chatMessageId: messageId,
                graphConceptId: citation.graphConceptId,
                citation: citation.citation,
              };
            default:
              throw new Error('Invalid context type provided');
          }
        });

        // Update the message in database with a transaction
        await db.$transaction(async (prisma) => {
          // Update message content
          await prisma.chatMessage.update({
            where: { id: messageId },
            data: {
              content: finalText,
              asyncChatStatus: AsyncChatStatus.COMPLETED,
            },
          });

          // Create artifacts
          for (const artifact of artifacts) {
            const isBase64 = artifact.encoding === 'base64';
            await prisma.chatArtifact.create({
              data: {
                id: artifact.id,
                fileExtension: artifact.fileExtension,
                label: artifact.label,
                content: isBase64 ? '' : artifact.content,
                binaryContent: isBase64 ? Buffer.from(artifact.content, 'base64') : null,
                chatMessageId: messageId,
                createdAt: artifact.createdAt,
                ...(artifact.sourceScript ? { sourceScript: artifact.sourceScript } : {}),
              },
            });
          }

          // Create follow-up questions
          if (followUpQuestions.length > 0) {
            await prisma.chatMessageFollowUp.createMany({
              data: followUpQuestions.map((question) => ({
                content: question,
                chatMessageId: messageId,
              })),
            });
          }

          // Persist the per-turn graph results as an ARRAY (one element per
          // qualifying cypher call). The legacy single-result paths store an array
          // of one; the read path normalizes any historical single-object rows.
          const persistedGraphData = agenticGraphSearchResults ?? (graphSearchResult ? [graphSearchResult] : undefined);
          if (persistedGraphData && persistedGraphData.length > 0) {
            await prisma.graphSearchResult.create({
              data: {
                label: graphSearchResultLabel ?? '',
                data: persistedGraphData as unknown as Prisma.InputJsonValue,
                chatMessageId: messageId,
              },
            });
          }
        });

        // Create citations outside the transaction so a FK violation doesn't roll back the message update
        if (citationData.length > 0) {
          try {
            await db.chatMessageCitation.createMany({ data: citationData });
          } catch (citationError: any) {
            if (citationError?.code === 'P2003') {
              logger.warn('[CHAT] Citation FK violation, retrying without graph citations', {
                messageId,
                error: citationError.message,
              });
              const safeCitations = citationData.filter(
                c => !('graphEntityId' in c) && !('graphConceptId' in c)
              );
              if (safeCitations.length > 0) {
                await db.chatMessageCitation.createMany({ data: safeCitations });
              }
            } else {
              throw citationError;
            }
          }
        }

        if (await isMemoryEnabled()) {
          void enqueueConversationGraphSync({
            chatId,
            messageIds: [messageId],
          });
        }

        // Persist progress messages to the database for post-completion trace rendering
        const finalProgressMessages = await storage.lrange(`chat-job-progress:${jobId}`, 0, -1);
        if (finalProgressMessages.length > 0) {
          await db.chatMessage.update({
            where: { id: messageId },
            data: { progressMessages: finalProgressMessages },
          });
        }

        // Store final result
        await storage.hset(`chat-job:${jobId}`, {
          status: 'completed',
          completed: Date.now(),
        });

        logger.info(`[CHAT] Chat job ${jobId} completed successfully`);
        return { success: true };
      } catch (error) {
        logger.error(`[CHAT] Chat job ${jobId} failed:`, error);

        // Update database status to error (leave content empty for UI to show RetryEntry)
        try {
          await db.chatMessage.update({
            where: { id: messageId },
            data: {
              asyncChatStatus: AsyncChatStatus.ERROR,
            },
          });
        } catch (dbError) {
          logger.error('[CHAT] Failed to update message status to error:', dbError);
        }

        await storage.hset(`chat-job:${jobId}`, {
          status: 'error',
          error: (error as Error).message,
          completed: Date.now(),
        });

        throw error;
      }
}
