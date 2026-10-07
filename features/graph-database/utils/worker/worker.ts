import { Worker, type Job } from 'bullmq';

import { getRedisClient } from '@/server/storage/redisConnection';
import { storage } from '@/server/storage/redis';
import { logger } from '@/server/logger';
import { GraphBuildJobData } from '@/features/graph-database/utils/worker/queue';
import db from '@/server/db';
import { getGraphDatabaseSource } from '@/features/graph-database';
import { extractEntitiesFromChunk } from '@/features/graph-database/services/entityExtractor';
import { createDocumentNode, embedDocumentEntities } from '@/features/graph-database/services/graphBuilder';
import { writeChunkGraph, writeSkippedChunk, getExtractedChunkIds, isDocumentExtractionComplete, markDocumentExtractionComplete, markDocumentResolutionComplete } from '@/features/graph-database/services/writeChunkGraph';
import { tryParsePalmGraph } from '@/features/graph-database/services/jsonIngest/detectPalmGraph';
import { ingestPalmGraph } from '@/features/graph-database/services/jsonIngest/ingestPalmGraph';
import { GraphBuildStatus } from '@/features/graph-database/types';
import type { ExtractionRunStats, ResolutionRunStats, Entity, Concept, ChunkNode, ChunkAnalysis } from '@/features/graph-database/types';
import { validateAllConfigs } from '@/features/graph-database/config/validate';
import { createBuildRun, completeBuildRun, failBuildRun, cancelBuildRun, cancelRunningBuildRunsForGraph } from '@/features/graph-database/dal/graphBuildRuns';
import { GraphBuildCancelledError, isGraphCancellationRequested, clearGraphCancellation } from '@/features/graph-database/utils/graphCancellation';
import { rollbackCancelledBuild } from '@/features/graph-database/dal/rollbackCancelledBuild';
import { settleFailedBuild } from '@/features/graph-database/dal/settleFailedBuild';
import { updateExtractionStats, updateResolutionStats } from '@/features/graph-database/dal/graphStats';
import { generateExtractionWarnings, generateResolutionWarnings } from '@/features/graph-database/services/buildRunWarnings';
import { persistResolutions } from '@/features/graph-database/services/resolutionExecutor';
import { resolveEntitiesV2 } from '@/features/graph-database/services/resolveEntitiesV2';
import { reconcileIdentityClusterHubs } from '@/features/graph-database/services/reconcileIdentityClusterHubs';
import { markDocumentPairResolved } from '@/features/graph-database/dal/documentResolutionPairs';
import { recoverStalledJobs, registerStalledJobReconciler } from '@/features/graph-database/services/stalledJobRecovery';
import { mergeDocumentMembership } from '@/features/graph-database/utils/mergeDocumentMembership';
import { resolveSchema } from '@/features/graph-database/config/schemas';
import { isEntityResolutionEnabled } from '@/features/graph-database/utils/isEntityResolutionEnabled';
import { reportJobFailure } from '@/server/reportJobFailure';

let worker: Worker | null = null;
let shutdownInProgress = false;
let workerStarted = false;

/**
 * Load entities from graphDb by document IDs or user ID
 */
async function loadEntitiesFromGraph(
  documentIds: string[],
  scope: 'document' | 'user',
  userId?: string
): Promise<Entity[]> {
  const query = scope === 'document'
    ? `MATCH (e:Entity)
       WHERE e.documentId IN $documentIds
       RETURN e.id as id, e.name as name, e.type as type,
              e.normalizedName as normalizedName, e.description as description,
              e.aliases as aliases, e.documentId as documentId,
              e.mentionCount as mentionCount, e.firstSeenAt as firstSeenAt`
    : `MATCH (d:Document {userId: $userId})-[:CONTAINS]->(c:Chunk)-[:MENTIONS]->(e:Entity)
       RETURN DISTINCT e.id as id, e.name as name, e.type as type,
              e.normalizedName as normalizedName, e.description as description,
              e.aliases as aliases, e.documentId as documentId,
              e.mentionCount as mentionCount, e.firstSeenAt as firstSeenAt`;

  const graphDb = await getGraphDatabaseSource();
  const params = scope === 'document' ? { documentIds } : { userId };
  const result = await graphDb.run(query, params);

  return result.records.map((record) => ({
    id: record.get('id'),
    name: record.get('name'),
    type: record.get('type'),
    normalizedName: record.get('normalizedName'),
    description: record.get('description'),
    aliases: record.get('aliases') || [],
    documentId: record.get('documentId'),
    mentionCount: record.get('mentionCount'),
    firstSeenAt: record.get('firstSeenAt'),
  }));
}

/**
 * Load concepts from graphDb by document IDs or user ID
 */
async function loadConceptsFromGraph(
  documentIds: string[],
  scope: 'document' | 'user',
  userId?: string
): Promise<Concept[]> {
  const query = scope === 'document'
    ? `MATCH (c:Concept)
       WHERE c.documentId IN $documentIds
       RETURN c.id as id, c.name as name, c.category as category,
              c.description as description, c.documentId as documentId,
              c.mentionCount as mentionCount, c.firstSeenAt as firstSeenAt`
    : `MATCH (d:Document {userId: $userId})-[:CONTAINS]->(ch:Chunk)-[:DISCUSSES]->(c:Concept)
       RETURN DISTINCT c.id as id, c.name as name, c.category as category,
              c.description as description, c.documentId as documentId,
              c.mentionCount as mentionCount, c.firstSeenAt as firstSeenAt`;
  const graphDb = await getGraphDatabaseSource();

  const params = scope === 'document' ? { documentIds } : { userId };
  const result = await graphDb.run(query, params);

  return result.records.map((record) => ({
    id: record.get('id'),
    name: record.get('name'),
    category: record.get('category'),
    description: record.get('description'),
    documentId: record.get('documentId'),
    mentionCount: record.get('mentionCount'),
    firstSeenAt: record.get('firstSeenAt'),
  }));
}

/**
 * Run entity resolution after graph extraction
 * This resolves duplicate entities/concepts across documents
 *
 * Throws if any block was left undecided by a failed LLM call — the caller relies
 * on that throw to skip marking documents resolution-complete.
 *
 * Returns the resolution build-run id so the caller's cancel path can flip the
 * run row to `cancelled` even after this function completed it — a mid-resolution
 * cancel exits gracefully and finishes bookkeeping before the caller's
 * checkpoint throws.
 */
export async function runEntityResolution(
  graphId: string,
  userId: string,
  documentIds: string[],
  jobId: string,
  isIncremental: boolean,
  existingDocumentIds: string[],
  shouldCancel?: () => Promise<boolean>
): Promise<string | null> {
  const scope = 'user';
  const newDocumentIds = documentIds;
  const existingGraphedDocIds = existingDocumentIds;

  // Create build run for stats tracking
  let resolutionRunId: string | null = null;

  // Initialize resolution stats
  const resolutionStats: ResolutionRunStats = {
    candidatesGenerated: 0,
    identityEdges: 0,
    similarEdges: 0,
    relatedEdges: 0,
    unrelatedPairs: 0,
    expectedDocPairs: 0,
    actualDocPairs: 0,
    duplicateResolutions: 0,
    avgConfidence: 0,
    minConfidence: 1,
    maxConfidence: 0,
    lowConfidenceIdentityCount: 0,
    decisionBreakdown: { identity: 0, similar: 0, related: 0, unrelated: 0 },
    byEntityType: {},
  };

  logger.info(`[GRAPH-BUILD] Starting entity resolution for graph ${graphId}`, {
    documentIds,
    scope,
    isIncremental,
    newDocs: newDocumentIds?.length || 0,
    existingDocs: existingGraphedDocIds?.length || 0,
  });

  // Start tracking resolution run
  resolutionRunId = await createBuildRun({
    graphId,
    userId,
    runType: 'resolution',
    documentIds,
    isIncremental: isIncremental || false,
    newDocumentIds: newDocumentIds || [],
    existingDocumentIds: existingGraphedDocIds || [],
  });

  // Update progress
  await storage.hset(`graph-job:${jobId}`, {
    status: 'resolving',
    progress: 'Loading entities and concepts...',
    last_updated: Date.now(),
  });

  // Load data from graphDb
  let entities: Entity[];
  let concepts: Concept[];
  let existingEntities: Entity[] = [];
  let existingConcepts: Concept[] = [];

  if (isIncremental && existingGraphedDocIds && existingGraphedDocIds.length > 0) {
    // Load NEW entities/concepts
    entities = await loadEntitiesFromGraph(newDocumentIds!, 'document', userId);
    concepts = await loadConceptsFromGraph(newDocumentIds!, 'document', userId);

    // Skip resolution entirely if extraction produced nothing
    if (entities.length === 0 && concepts.length === 0) {
      logger.info('[GRAPH-BUILD] No new entities or concepts extracted, skipping resolution');
      return resolutionRunId;
    }

    // Load EXISTING entities/concepts (for cross-doc comparison)
    existingEntities = await loadEntitiesFromGraph(existingGraphedDocIds, 'document', userId);
    existingConcepts = await loadConceptsFromGraph(existingGraphedDocIds, 'document', userId);

    logger.info('[GRAPH-BUILD] Loaded entities for incremental resolution', {
      newEntities: entities.length,
      newConcepts: concepts.length,
      existingEntities: existingEntities.length,
      existingConcepts: existingConcepts.length,
    });
  } else {
    // Full resolution - load all entities from all documents
    entities = await loadEntitiesFromGraph(documentIds, scope, userId);
    concepts = await loadConceptsFromGraph(documentIds, scope, userId);

    logger.info(`[GRAPH-BUILD] Loaded ${entities.length} entities, ${concepts.length} concepts`);
  }

  await storage.hset(`graph-job:${jobId}`, {
    progress: `Loaded ${entities.length + existingEntities.length} entities, ${concepts.length + existingConcepts.length} concepts`,
    last_updated: Date.now(),
  });

  // Resolution runs the V2 (blocking + cluster-based) algorithm: entities and
  // concepts are blocked, each block's identity edges are decided directly, and
  // confirmed-edge closure keeps clusters transitively consistent by
  // construction — so no separate transitivity-repair pass is needed.
  logger.info('[GRAPH-BUILD] Running V2 (blocking + cluster-based) resolution');
  const newNodes: Array<Entity | Concept> = [...entities, ...concepts];
  const existingNodes: Array<Entity | Concept> = [...existingEntities, ...existingConcepts];

  const { resolutions, failedCalls } = await resolveEntitiesV2({ newNodes, existingNodes, userId, scope, shouldCancel });
  const candidatesGenerated = resolutions.length;

  await storage.hset(`graph-job:${jobId}`, {
    progress: `V2 resolution produced ${resolutions.length} edges`,
    last_updated: Date.now(),
  });

  const edgeTypeCounts = {
    identity: resolutions.filter((r) => r.edgeType === 'IDENTITY').length,
    similar: resolutions.filter((r) => r.edgeType === 'SIMILAR').length,
    related: resolutions.filter((r) => r.edgeType === 'RELATED_RESOLUTION').length,
  };

  // Compute confidence metrics
  const confidences = resolutions.map((r) => r.confidence);
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;
  const minConfidence = confidences.length > 0 ? Math.min(...confidences) : 0;
  const maxConfidence = confidences.length > 0 ? Math.max(...confidences) : 0;
  const lowConfidenceIdentityCount = resolutions.filter(
    (r) => r.edgeType === 'IDENTITY' && r.confidence < 0.8
  ).length;

  const expectedDocPairs = isIncremental
    ? (existingGraphedDocIds?.length || 0)
    : Math.max(0, (documentIds.length * (documentIds.length - 1)) / 2);

  // Update resolution stats
  resolutionStats.candidatesGenerated = candidatesGenerated;
  resolutionStats.identityEdges = edgeTypeCounts.identity;
  resolutionStats.similarEdges = edgeTypeCounts.similar;
  resolutionStats.relatedEdges = edgeTypeCounts.related;
  resolutionStats.unrelatedPairs = Math.max(0, candidatesGenerated - resolutions.length);
  resolutionStats.expectedDocPairs = expectedDocPairs;
  resolutionStats.actualDocPairs = isIncremental ? (existingGraphedDocIds?.length || 0) : documentIds.length;
  resolutionStats.avgConfidence = Number(avgConfidence.toFixed(3));
  resolutionStats.minConfidence = Number(minConfidence.toFixed(3));
  resolutionStats.maxConfidence = Number(maxConfidence.toFixed(3));
  resolutionStats.lowConfidenceIdentityCount = lowConfidenceIdentityCount;
  resolutionStats.decisionBreakdown = {
    identity: edgeTypeCounts.identity,
    similar: edgeTypeCounts.similar,
    related: edgeTypeCounts.related,
    unrelated: Math.max(0, candidatesGenerated - resolutions.length),
  };

  logger.info(`[GRAPH-BUILD] Resolved ${resolutions.length} relationships`, edgeTypeCounts);

  await storage.hset(`graph-job:${jobId}`, {
    progress: `Resolved ${resolutions.length} relationships`,
    last_updated: Date.now(),
  });

  // Persist edges to graphDb. Deliberately BEFORE the failure gate below: the
  // decisions that did succeed are valid and MERGE is idempotent, so a retry
  // re-runs and completes without losing them.
  logger.info('[GRAPH-BUILD] Persisting resolution edges...');
  await persistResolutions(resolutions);

  // Any block left undecided by a failed LLM call means this run is INCOMPLETE.
  // Throwing here is what skips the caller's markDocumentResolutionComplete loop
  // (documents must not look resolved when they aren't) and routes into the
  // outer catch → failBuildRun → status Failed → BullMQ retry.
  if (failedCalls > 0) {
    const message = `Resolution incomplete: ${failedCalls} block LLM call(s) failed after retries — not marking documents resolved`;
    logger.error(`[GRAPH-BUILD] ${message}`, { graphId, failedCalls, persistedEdges: resolutions.length });
    if (resolutionRunId) {
      await failBuildRun(resolutionRunId, message, resolutionStats);
    }
    throw new Error(message);
  }

  // Complete resolution build run
  if (resolutionRunId) {
    const resolutionWarnings = generateResolutionWarnings(resolutionStats);
    await completeBuildRun({
      runId: resolutionRunId,
      stats: resolutionStats,
      warnings: resolutionWarnings,
    });
    await updateResolutionStats(graphId, resolutionStats);
  }

  // Mark document pairs as resolved (for incremental resolution tracking)
  if (isIncremental && newDocumentIds && existingGraphedDocIds) {
    const pairStatsMap = new Map<string, {
      candidatesGenerated: number;
      identityEdges: number;
      similarEdges: number;
      relatedEdges: number;
    }>();

    const getPairKey = (doc1: string, doc2: string) => {
      return doc1 < doc2 ? `${doc1}|${doc2}` : `${doc2}|${doc1}`;
    };

    // Per-pair edge counts come from `resolutions`. V2 does not track a separate
    // per-pair candidate count, so `candidatesGenerated` stays 0 per pair.
    for (const resolution of resolutions) {
      const doc1 = resolution.entity1.documentId;
      const doc2 = resolution.entity2.documentId;
      if (doc1 !== doc2) {
        const key = getPairKey(doc1, doc2);
        if (!pairStatsMap.has(key)) {
          pairStatsMap.set(key, {
            candidatesGenerated: 0,
            identityEdges: 0,
            similarEdges: 0,
            relatedEdges: 0,
          });
        }
        const stats = pairStatsMap.get(key)!;
        if (resolution.edgeType === 'IDENTITY') {
          stats.identityEdges++;
        } else if (resolution.edgeType === 'SIMILAR') {
          stats.similarEdges++;
        } else if (resolution.edgeType === 'RELATED_RESOLUTION') {
          stats.relatedEdges++;
        }
      }
    }

    for (const newDocId of newDocumentIds) {
      for (const existingDocId of existingGraphedDocIds) {
        const key = getPairKey(newDocId, existingDocId);
        const pairStats = pairStatsMap.get(key) || {
          candidatesGenerated: 0,
          identityEdges: 0,
          similarEdges: 0,
          relatedEdges: 0,
        };

        await markDocumentPairResolved({
          document1Id: newDocId,
          document2Id: existingDocId,
          userId,
          candidatesGenerated: pairStats.candidatesGenerated,
          identityEdgesCreated: pairStats.identityEdges,
          similarEdgesCreated: pairStats.similarEdges,
          relatedEdgesCreated: pairStats.relatedEdges,
        });
      }
    }
  }

  logger.info(`[GRAPH-BUILD] Entity resolution complete for graph ${graphId}`, {
    candidatesGenerated,
    totalResolutions: resolutions.length,
  });

  return resolutionRunId;
}

/**
 * Terminal error routing for a build job — the two-terminal-paths contract.
 *
 * Cancel (the checkpoint throw, OR a cancel flag that raced a natural failure)
 * → full rollback of this run, and this job's run rows are flipped to
 * `cancelled` BY ID: a mid-resolution cancel lets each phase finish its own
 * bookkeeping before the checkpoint throws, so the rows may already read
 * `completed` for work the rollback just undid. The running-rows sweep stays as
 * a backstop for runs this job lost track of.
 *
 * Genuine failure → preserve-for-resume, but ONLY once BullMQ is out of
 * retries: settling between attempts flashed a transient false `Completed` at
 * the 2s-polling UI. On non-final attempts the graph row is left in place
 * (Building/Resolving) so the UI honestly shows an in-progress build through
 * the backoff, and the cancel flag is left readable so a cancel requested
 * during the backoff still kills the retry at its first checkpoint.
 */
export async function handleBuildTerminalError({
  error,
  job,
  buildRunId,
  resolutionRunId,
  extractionStats,
}: {
  error: Error;
  job: Job<GraphBuildJobData>;
  buildRunId: string | null;
  resolutionRunId: string | null;
  extractionStats: ExtractionRunStats;
}): Promise<'cancelled' | 'retry' | 'failed'> {
  const { graphId, userId, extractDocumentIds, jobId } = job.data;

  if (error instanceof GraphBuildCancelledError || (await isGraphCancellationRequested(graphId))) {
    logger.info(`[GRAPH-BUILD] Build cancelled by user, rolling back this run: ${graphId}`);
    await rollbackCancelledBuild({ graphId, userId, extractDocumentIds });
    if (buildRunId) {
      await cancelBuildRun(buildRunId, extractionStats);
    }
    if (resolutionRunId) {
      await cancelBuildRun(resolutionRunId);
    }
    await cancelRunningBuildRunsForGraph(graphId);
    await clearGraphCancellation(graphId);
    return 'cancelled';
  }

  logger.error(`[GRAPH-BUILD] Graph build failed: ${graphId}`, error);

  if (buildRunId) {
    await failBuildRun(buildRunId, error.message, extractionStats);
  }

  // Mirror BullMQ's own retry decision — `attemptsMade` counts prior attempts.
  const maxAttempts = job.opts.attempts ?? 1;
  if (job.attemptsMade + 1 < maxAttempts) {
    logger.info(`[GRAPH-BUILD] Attempt ${job.attemptsMade + 1}/${maxAttempts} failed, retry scheduled: ${graphId}`);
    return 'retry';
  }

  // The partial graph IS the checkpoint — only fully-committed chunks remain
  // (per-chunk transactions), so preserve it for resume instead of wiping it.
  logger.info(`[GRAPH-BUILD] Preserving partial graph for resume after final failed attempt: ${graphId}`);
  await settleFailedBuild({
    graphId,
    userId,
    extractDocumentIds,
    errorMessage: error.message,
  });

  await storage.hset(`graph-job:${jobId}`, {
    status: 'failed',
    error: error.message,
    last_updated: Date.now(),
  });

  await clearGraphCancellation(graphId);
  return 'failed';
}

const shutdown = async (signal: string): Promise<void> => {
  if (shutdownInProgress) {
    return;
  }
  shutdownInProgress = true;

  logger.info(`[GRAPH-BUILD] ${signal} received, shutting down graph build worker...`);

  try {
    if (worker) {
      const forceShutdownTimeout = setTimeout(() => {
        logger.warn('[GRAPH-BUILD] Force shutting down graph build worker after timeout');
        process.exit(1);
      }, 15000);

      await worker.close();
      clearTimeout(forceShutdownTimeout);
      worker = null;
      workerStarted = false;
      logger.info('[GRAPH-BUILD] Graph build worker closed successfully');
    }

    // Shutdown graphDb connection
    const graphDb = await getGraphDatabaseSource();
    await graphDb.disconnect();
  } catch (error) {
    logger.error('[GRAPH-BUILD] Error shutting down graph build worker:', error);
    throw error;
  }
};

export const startGraphBuildWorker = async (): Promise<void> => {
  // Validate GraphRAG configuration on startup
  validateAllConfigs();

  logger.info('[GRAPH-BUILD] startGraphBuildWorker called, current state:', {
    workerExists: !!worker,
    workerRunning: worker?.isRunning() || false,
    workerStarted,
  });

  if (workerStarted && worker?.isRunning()) {
    logger.info('[GRAPH-BUILD] Graph build worker is already running, skipping initialization');
    return;
  }

  let connection;

  try {
    connection = getRedisClient();
  } catch (error) {
    logger.warn('[GRAPH-BUILD] Redis not available — skipping graph build worker startup.');
    return;
  }

  if (!storage) {
    logger.warn('[GRAPH-BUILD] Storage is not enabled, skipping graph build worker startup.');
    return;
  }

  // Close existing worker if it exists
  if (worker) {
    logger.info('[GRAPH-BUILD] Worker instance exists, attempting to close...');
    try {
      await worker.close();
      logger.info('[GRAPH-BUILD] Existing worker closed successfully');
      worker = null;
      workerStarted = false;
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (closeError) {
      logger.warn('[GRAPH-BUILD] Error closing existing worker (ignoring):', closeError);
      worker = null;
      workerStarted = false;
    }
  }

  logger.info('[GRAPH-BUILD] Creating new graph build Worker instance...');

  // Initialize graphDb connection
  const graphDb = await getGraphDatabaseSource();
  await graphDb.connect();

  // Enforce the hub invariant before accepting builds — a no-op unless
  // IDENTITY edges exist without hub maintenance (pre-hub data, legacy V1
  // output). Failure must not block startup: builds self-heal via
  // maintainClusterHubs and the next restart retries.
  try {
    await reconcileIdentityClusterHubs();
  } catch (error) {
    logger.error('[HUB-RECONCILE] Startup reconciliation failed; continuing worker startup', { error });
  }

  const workerId = `graph-worker-${process.pid}-${Date.now()}`;
  logger.info('[GRAPH-BUILD] Using graph worker ID:', workerId);

  worker = new Worker<GraphBuildJobData>(
    'graph-build-jobs',
    async (job) => {
      const { graphId, userId, documentIds, extractDocumentIds, jobId, isIncremental, existingDocumentIds,
        schemaKey, schemaKeysByDocumentId } = job.data;

      const throwIfCancelled = async (): Promise<void> => {
        if (await isGraphCancellationRequested(graphId)) {
          throw new GraphBuildCancelledError(graphId);
        }
      };

      // Create build run for stats tracking
      let buildRunId: string | null = null;
      let resolutionRunId: string | null = null;
      const extractionStats: ExtractionRunStats = {
        chunksProcessed: 0,
        entitiesCreated: 0,
        entitiesMerged: 0,
        conceptsCreated: 0,
        relationshipsCreated: 0,
        skippedChunkIds: [],
        byDocument: {},
      };

      try {
        // Start tracking this extraction run
        buildRunId = await createBuildRun({
          graphId,
          userId,
          runType: 'extraction',
          documentIds,
          isIncremental: isIncremental || false,
          newDocumentIds: extractDocumentIds,
          existingDocumentIds: existingDocumentIds || [],
        });

        logger.info(`[GRAPH-BUILD] Starting graph build: ${graphId} for ${documentIds.length} documents`);

        // Update status to BUILDING
        await db.graphMetadata.update({
          where: { graphId },
          data: { status: GraphBuildStatus.Building },
        });

        // Update job status in Redis
        await storage.hset(`graph-job:${jobId}`, {
          status: 'building',
          progress: 'Fetching document chunks...',
          last_updated: Date.now(),
        });

        // Get all chunks for the selected documents
        // Load chunks ONLY for docs that still need extraction. Docs that are
        // already extracted but only need resolution are not loaded here, so they
        // are never re-extracted and never appear as "extracting" in progress.
        const embeddings = await db.embedding.findMany({
          where: {
            documentId: { in: extractDocumentIds },
          },
          orderBy: [
            { documentId: 'asc' },
            { contentNum: 'asc' },
          ],
          include: {
            document: {
              select: {
                id: true,
                filename: true,
                uploadStatus: true,
                userId: true,
                documentUploadProviderId: true,
              },
            },
          },
        });

        const totalChunks = embeddings.length;
        logger.info(`[GRAPH-BUILD] Found ${totalChunks} chunks to process`);

        // A resolution-only run (every requested doc is already extracted) loads
        // zero chunks by design: the document loop runs zero times and we fall
        // through to resolution. Only a run that SHOULD extract something but found
        // no chunks is a real error.
        if (totalChunks === 0 && extractDocumentIds.length > 0) {
          throw new Error('No chunks found for the selected documents');
        }

        // Update progress in database
        await db.graphMetadata.update({
          where: { graphId },
          data: {
            buildProgress: {
              newDocumentIds: extractDocumentIds,
              totalChunks,
              processedChunks: 0,
              currentStep: 'Processing chunks',
            },
          },
        });

        // Update progress in Redis
        await storage.hset(`graph-job:${jobId}`, {
          progress: `Processing ${totalChunks} chunks...`,
          totalChunks,
          processedChunks: 0,
          last_updated: Date.now(),
        });

        // Group chunks by document
        const documentGroups = new Map<string, typeof embeddings>();
        embeddings.forEach((emb) => {
          const docId = emb.documentId;
          if (!documentGroups.has(docId)) {
            documentGroups.set(docId, []);
          }
          documentGroups.get(docId)!.push(emb);
        });

        let processedChunks = 0;

        // Process each document
        for (const [, docEmbeddings] of documentGroups) {
          await throwIfCancelled();

          const doc = docEmbeddings[0].document;

          // Per-document schema: the override map wins over the batch-default
          // `schemaKey`; `resolveSchema` falls back to `general`.
          const docSchema = resolveSchema(schemaKeysByDocumentId?.[doc.id] ?? schemaKey);
          if (docSchema) {
            logger.info(`[GRAPH-BUILD] Using extraction schema "${docSchema.key}" for ${doc.filename}`);
          }

          logger.info(`[GRAPH-BUILD] Processing document: ${doc.filename} (${docEmbeddings.length} chunks)`);

          // Resume: skip documents whose extraction pass already finished in a prior run
          if (await isDocumentExtractionComplete(doc.id)) {
            processedChunks += docEmbeddings.length;

            await db.graphMetadata.update({
              where: { graphId },
              data: {
                buildProgress: {
                  newDocumentIds: extractDocumentIds,
                  totalChunks,
                  processedChunks,
                  currentStep: `Skipped already-extracted ${doc.filename}`,
                },
              },
            });

            await storage.hset(`graph-job:${jobId}`, {
              processedChunks,
              progress: `Processed ${processedChunks}/${totalChunks} chunks...`,
              last_updated: Date.now(),
            });

            logger.info(`[GRAPH-BUILD] Skipping already-extracted document: ${doc.filename} (${processedChunks}/${totalChunks})`);
            continue;
          }

          let palmGraph = null;
          if (doc.filename.toLowerCase().endsWith('.json')) {
            const docRecord = await db.document.findUnique({
              where: { id: doc.id },
              select: { text: true },
            });
            palmGraph = tryParsePalmGraph(docRecord?.text ?? null);
          }

          if (palmGraph) {
            logger.info(`[GRAPH-BUILD] Routing ${doc.filename} to palm-graph ingest`);
            await storage.hset(`graph-job:${jobId}`, {
              progress: `Ingesting palm-graph: ${doc.filename}...`,
              last_updated: Date.now(),
            });
            const ingestResult = await ingestPalmGraph({
              palmGraph,
              document: {
                id: doc.id,
                filename: doc.filename,
                uploadStatus: doc.uploadStatus,
                createdAt: new Date(),
                userId: doc.userId,
                documentUploadProviderId: doc.documentUploadProviderId,
                totalChunks: docEmbeddings.length,
                totalTokens: 0,
              },
              userId,
              logger,
            });
            extractionStats.byDocument[doc.id] = {
              entities: ingestResult.entityCount,
              concepts: ingestResult.conceptCount,
              chunks: docEmbeddings.length,
              extractedAt: new Date().toISOString(),
            };
            extractionStats.chunksProcessed += docEmbeddings.length;
            extractionStats.entitiesCreated += ingestResult.entityCount;
            extractionStats.conceptsCreated += ingestResult.conceptCount;
            extractionStats.relationshipsCreated += ingestResult.edgeCount;
            processedChunks += docEmbeddings.length;

            await db.graphMetadata.update({
              where: { graphId },
              data: {
                buildProgress: {
                  newDocumentIds: extractDocumentIds,
                  totalChunks,
                  processedChunks,
                  currentStep: `Processed ${doc.filename}`,
                },
              },
            });

            await storage.hset(`graph-job:${jobId}`, {
              processedChunks,
              progress: `Processed ${processedChunks}/${totalChunks} chunks...`,
              last_updated: Date.now(),
            });

            // Mark the (idempotent) palm-graph ingest done so a later resume skips it.
            // Sub-document resume for JSON ingest is a follow-up; ingestPalmGraph is MERGE-idempotent.
            await markDocumentExtractionComplete(doc.id);

            logger.info(`[GRAPH-BUILD] Completed palm-graph document: ${doc.filename} (${processedChunks}/${totalChunks})`);
            continue;
          }

          // Resumable per-chunk flow: extract → write that chunk's graph in a
          // single Neo4j transaction → mark it extracted → next chunk. The
          // `extracted` marker is the durable checkpoint, so a mid-build restart
          // resumes from the last committed chunk with no LLM re-calls.
          await createDocumentNode({
            id: doc.id,
            filename: doc.filename,
            uploadStatus: doc.uploadStatus,
            createdAt: new Date(),
            userId: doc.userId,
            documentUploadProviderId: doc.documentUploadProviderId,
            totalChunks: docEmbeddings.length,
            totalTokens: 0,
          });

          await storage.hset(`graph-job:${jobId}`, {
            progress: `Extracting & writing ${doc.filename} per chunk...`,
            last_updated: Date.now(),
          });

          const extractedIds = await getExtractedChunkIds(doc.id);
          let prevChunkId: string | null = null;
          let docEntities = 0;
          let docConcepts = 0;
          let docRelationships = 0;
          const PROGRESS_WRITE_INTERVAL = 5;

          const MAX_CHUNK_ATTEMPTS = 3;
          const skippedChunkIds: string[] = [];

          for (let i = 0; i < docEmbeddings.length; i++) {
            // Checked every chunk, not batched: a Redis GET is negligible next to
            // the LLM call each chunk makes, so there's no reason to let a
            // multi-chunk batch delay noticing a cancel.
            await throwIfCancelled();

            const emb = docEmbeddings[i];

            // Skip chunks already written in a prior run (no LLM re-call, no duplicate writes).
            // Still increment processedChunks so resume progress is accurate.
            if (extractedIds.has(emb.id)) {
              prevChunkId = emb.id;
              processedChunks++;
              continue;
            }

            // Bounded retry around extract + write. extractEntitiesFromChunk already
            // retries the LLM internally; this also covers transient Neo4j/write blips.
            let analysis: ChunkAnalysis | null = null;
            let lastError: unknown = null;
            for (let attempt = 1; attempt <= MAX_CHUNK_ATTEMPTS; attempt++) {
              try {
                const candidate = await extractEntitiesFromChunk(emb.content, emb.id, userId, doc.id, docSchema);

                const chunkNode: ChunkNode = {
                  id: emb.id,
                  content: emb.content,
                  contentNum: emb.contentNum,
                  tokenCount: 0,
                  createdAt: emb.createdAt,
                  embeddingId: emb.id,
                  summary: candidate.summary,
                  startPosition: emb.startPosition,
                  endPosition: emb.endPosition,
                };

                await writeChunkGraph({
                  documentId: doc.id,
                  chunk: chunkNode,
                  prevChunkId,
                  position: i,
                  analysis: candidate,
                  userId,
                  allowedRelationTypes: docSchema?.edgeTypes.map((e) => e.relationType),
                  schemaKey: docSchema?.key ?? 'general',
                });

                analysis = candidate;
                break;
              } catch (chunkError) {
                lastError = chunkError;
                logger.warn(
                  `[GRAPH-BUILD] Chunk ${emb.id} failed (attempt ${attempt}/${MAX_CHUNK_ATTEMPTS}) for ${doc.filename}`,
                  chunkError
                );
              }
            }

            if (analysis) {
              docEntities += analysis.entities.length;
              docConcepts += analysis.concepts.length;
              docRelationships += analysis.relationships.length;
              prevChunkId = emb.id;
            } else {
              // Skip the chunk: checkpoint an entity-less marker so the build continues
              // and resume skips it, leaving a durable trace of which chunk failed and why.
              const reason = lastError instanceof Error ? lastError.message : 'unknown error';
              try {
                await writeSkippedChunk({
                  documentId: doc.id,
                  chunk: {
                    id: emb.id,
                    content: emb.content,
                    contentNum: emb.contentNum,
                    tokenCount: 0,
                    createdAt: emb.createdAt,
                    embeddingId: emb.id,
                    summary: '',
                    startPosition: emb.startPosition,
                    endPosition: emb.endPosition,
                  },
                  prevChunkId,
                  position: i,
                  userId,
                  reason,
                });
                // Marker committed — keep the NEXT chain continuous through it.
                prevChunkId = emb.id;
              } catch (markerError) {
                // Even the marker write failed (deeper Neo4j issue). Leave prevChunkId as-is
                // so the next good chunk links from the last committed chunk; this chunk stays
                // unmarked and will be retried on a later resume.
                logger.error(`[GRAPH-BUILD] Failed to write skipped-chunk marker for ${emb.id}`, markerError);
              }
              skippedChunkIds.push(emb.id);
              logger.error(
                `[GRAPH-BUILD] Skipped chunk ${emb.id} after ${MAX_CHUNK_ATTEMPTS} failed attempts (${doc.filename}): ${reason}`
              );
            }

            processedChunks++;

            // Periodic progress writes (every N chunks) to avoid hammering Redis/Postgres;
            // the per-chunk `extracted` marker in Neo4j is the real checkpoint.
            if (processedChunks % PROGRESS_WRITE_INTERVAL === 0) {
              await db.graphMetadata.update({
                where: { graphId },
                data: {
                  buildProgress: {
                    newDocumentIds: extractDocumentIds,
                    totalChunks,
                    processedChunks,
                    currentStep: `Extracting ${doc.filename}`,
                  },
                },
              });
              await storage.hset(`graph-job:${jobId}`, {
                processedChunks,
                progress: `Processed ${processedChunks}/${totalChunks} chunks...`,
                last_updated: Date.now(),
              });
            }
          }

          // Per-document embedding pass (resumable via needsEmbedding), then mark
          // the document done so a later resume skips it entirely.
          await embedDocumentEntities(doc.id, userId);
          await markDocumentExtractionComplete(doc.id);

          // Track stats for this document. Chunks skipped on resume were already
          // counted in a prior run, so they contribute 0 new entities/concepts here.
          extractionStats.byDocument[doc.id] = {
            entities: docEntities,
            concepts: docConcepts,
            chunks: docEmbeddings.length,
            extractedAt: new Date().toISOString(),
          };
          extractionStats.chunksProcessed += docEmbeddings.length;
          extractionStats.entitiesCreated += docEntities;
          extractionStats.conceptsCreated += docConcepts;
          extractionStats.relationshipsCreated += docRelationships;
          if (skippedChunkIds.length > 0) {
            extractionStats.skippedChunkIds = [
              ...(extractionStats.skippedChunkIds ?? []),
              ...skippedChunkIds,
            ];
          }

          // Final progress write for the document
          await db.graphMetadata.update({
            where: { graphId },
            data: {
              buildProgress: {
                newDocumentIds: extractDocumentIds,
                totalChunks,
                processedChunks,
                currentStep: `Processed ${doc.filename}`,
              },
            },
          });
          await storage.hset(`graph-job:${jobId}`, {
            processedChunks,
            progress: `Processed ${processedChunks}/${totalChunks} chunks...`,
            last_updated: Date.now(),
          });

          logger.info(`[GRAPH-BUILD] Completed document (resumable): ${doc.filename} (${processedChunks}/${totalChunks})`);
        }

        // Finalize the graph's stored document membership. Read the row's CURRENT
        // membership (the gate wrote the full union before queuing) and union the
        // docs this run processed — membership only ever grows. Never recompute it
        // from the queued `existingDocumentIds`: on an incremental build that is
        // the resolution base, which is empty until docs are resolution-marked, so
        // recomputing from it would truncate the graph and drop every previously-
        // graphed document. `existingDocumentIds` stays scoped to resolution only.
        const currentMetadata = await db.graphMetadata.findUnique({
          where: { graphId },
          select: { documentIds: true },
        });
        const priorDocumentIds = (currentMetadata?.documentIds as string[] | undefined) ?? [];
        const finalDocumentIds = mergeDocumentMembership(priorDocumentIds, documentIds);
        if (isIncremental) {
          logger.info(`[GRAPH-BUILD] Incremental build complete: ${priorDocumentIds.length} prior + ${documentIds.length} processed = ${finalDocumentIds.length} total docs`);
        }

        // Complete extraction build run with stats
        if (buildRunId) {
          const warnings = generateExtractionWarnings(extractionStats);
          await completeBuildRun({
            runId: buildRunId,
            stats: extractionStats,
            warnings,
          });
          await updateExtractionStats(graphId, extractionStats);
        }

        await throwIfCancelled();

        // Run entity resolution (gated by the SystemConfig ER toggle)
        if (await isEntityResolutionEnabled()) {
          // Transition to Resolving status
          await db.graphMetadata.update({
            where: { graphId },
            data: {
              status: GraphBuildStatus.Resolving,
              documentIds: finalDocumentIds,
              buildProgress: {
                newDocumentIds: extractDocumentIds,
                totalChunks,
                processedChunks,
                currentStep: 'Starting entity resolution...',
              },
            },
          });

          // Run resolution inline
          resolutionRunId = await runEntityResolution(
            graphId,
            userId,
            documentIds,
            jobId,
            isIncremental || false,
            existingDocumentIds || [],
            () => isGraphCancellationRequested(graphId)
          );

          // A mid-resolution cancel breaks resolveEntitiesV2's block loop without
          // throwing (decided blocks persist normally). This is the checkpoint that
          // turns that into an abort: it must fire BEFORE the loop below so a
          // cancelled run never marks documents resolution-complete.
          await throwIfCancelled();

          // Mark resolution-complete for the docs this run actually covered so
          // the build gate can route incrementally off per-document state
          // instead of the graph-level Completed flag: the requested docs were
          // just resolved, and the existing docs are the already-resolved base
          // (re-marking them is an idempotent no-op). Deliberately NOT the full
          // graph membership — a membership doc in neither set (e.g. extracted
          // while ER was off, or stranded by a failed resolution) was NOT
          // resolved by this run and must stay unmarked so it remains eligible.
          // Derived state — a write failure here only means a doc re-resolves
          // next build, so it must not fail an otherwise-successful build.
          try {
            const participatingDocIds = new Set([...documentIds, ...(existingDocumentIds || [])]);
            for (const docId of participatingDocIds) {
              await markDocumentResolutionComplete(docId);
            }
          } catch (markError) {
            logger.warn(`[GRAPH-BUILD] Failed to mark resolution-complete markers for graph ${graphId}`, markError);
          }

          // Mark as completed after resolution. errorMessage is cleared: a
          // Completed row with an errorMessage is the settled-failure record
          // (see settleFailedBuild), and this is a genuine success.
          await db.graphMetadata.update({
            where: { graphId },
            data: {
              status: GraphBuildStatus.Completed,
              completedAt: new Date(),
              documentIds: finalDocumentIds,
              errorMessage: null,
              buildProgress: {
                newDocumentIds: extractDocumentIds,
                totalChunks,
                processedChunks,
                currentStep: 'Completed',
              },
            },
          });

          await storage.hset(`graph-job:${jobId}`, {
            status: 'completed',
            progress: 'Graph build complete',
            completedAt: Date.now(),
            last_updated: Date.now(),
          });

          await clearGraphCancellation(graphId);

          logger.info(`[GRAPH-BUILD] Graph build completed with resolution: ${graphId}`);

          return { graphId, success: true, chunksProcessed: totalChunks, resolutionRan: true };
        } else {
          // Entity resolution feature is disabled - mark complete without resolution
          logger.info('[GRAPH-BUILD] Entity resolution feature disabled, skipping resolution');

          await db.graphMetadata.update({
            where: { graphId },
            data: {
              status: GraphBuildStatus.Completed,
              completedAt: new Date(),
              documentIds: finalDocumentIds,
              errorMessage: null,
              buildProgress: {
                newDocumentIds: extractDocumentIds,
                totalChunks,
                processedChunks,
                currentStep: 'Completed (no resolution)',
              },
            },
          });

          await storage.hset(`graph-job:${jobId}`, {
            status: 'completed',
            progress: 'Graph build complete (no resolution)',
            completedAt: Date.now(),
            last_updated: Date.now(),
          });

          await clearGraphCancellation(graphId);

          logger.info(`[GRAPH-BUILD] Graph build completed without resolution: ${graphId}`);

          return { graphId, success: true, chunksProcessed: totalChunks, resolutionRan: false };
        }
      } catch (error) {
        const outcome = await handleBuildTerminalError({
          error: error as Error,
          job,
          buildRunId,
          resolutionRunId,
          extractionStats,
        });
        if (outcome === 'cancelled') {
          return { graphId, success: false, cancelled: true, resolutionRan: false };
        }
        throw error;
      }
    },
    {
      connection,
      concurrency: 1, // Process one graph at a time to avoid overwhelming LLM/graphDb
      lockDuration: 600000, // 10 minutes
      stalledInterval: 60000, // 1 minute
      maxStalledCount: 2,
      name: workerId,
      limiter: {
        max: 2, // Max 2 jobs per minute to prevent rate limiting
        duration: 60000,
      },
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(`[GRAPH-BUILD] Job ${job?.id} failed:`, err);
    reportJobFailure(job, err);
  });

  // Recover Postgres state orphaned by a prior worker death (stuck Building/
  // Resolving/Pending rows + 'running' build runs), then keep reconciling at
  // runtime. Best-effort — recovery failures must never block worker startup.
  try {
    const { runsFailed, metadataReverted } = await recoverStalledJobs();
    logger.info(`[GRAPH-BUILD] Startup recovery: ${runsFailed} build_runs failed, ${metadataReverted} graph_metadata reverted`);
  } catch (error) {
    logger.error('[GRAPH-BUILD] Startup stalled-job recovery failed (continuing):', error);
  }
  registerStalledJobReconciler('graph-build-jobs');

  // Graceful shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    logger.info('[GRAPH-BUILD] About to call graph worker.run()...');

    if (worker.isRunning()) {
      logger.info('[GRAPH-BUILD] Graph worker is already running, skipping run() call');
      return;
    }

    await worker.run();
    logger.info('[GRAPH-BUILD] Graph build worker started successfully');
    workerStarted = true;
  } catch (error) {
    logger.error('[GRAPH-BUILD] Caught error in graph worker.run():', error);
    if (error instanceof Error && error.message.includes('already running')) {
      logger.info('[GRAPH-BUILD] Graph worker was already running, ignoring error and continuing');
      return;
    }
    logger.error('[GRAPH-BUILD] Re-throwing unexpected error:', error);
    throw error;
  }
};
