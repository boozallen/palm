import { z } from 'zod';
import { v4 } from 'uuid';
import crypto from 'crypto';
import { procedure } from '@/server/trpc';
import { getGraphBuildQueue } from '@/features/graph-database/utils/worker/queue';
import { GraphBuildStatus } from '@/features/graph-database/types';
import createGraphMetadata from '@/features/graph-database/dal/createGraphMetadata';
import getGraphMetadata from '@/features/graph-database/dal/getGraphMetadata';
import verifyDocumentOwnership from '@/features/graph-database/dal/verifyDocumentOwnership';
import { getResolvedDocumentIds } from '@/features/graph-database/dal/getResolvedDocumentIds';
import { getExtractedDocumentIds } from '@/features/graph-database/dal/getExtractedDocumentIds';
import { isEntityResolutionEnabled } from '@/features/graph-database/utils/isEntityResolutionEnabled';
import { clearGraphCancellation } from '@/features/graph-database/utils/graphCancellation';
import db from '@/server/db';

const inputSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1, 'At least one document is required'),
  // Selected extraction schema key (CUSTOM_GRAPH_SCHEMA). Undefined → worker
  // resolves to the default `general` schema.
  schemaKey: z.string().optional(),
  // Per-document schema overrides keyed by document id. An entry wins over the
  // batch-default `schemaKey`; documents without an entry fall back to it.
  schemaKeysByDocumentId: z.record(z.string().uuid(), z.string()).optional(),
});

const outputSchema = z.object({
  graphId: z.string(),
  status: z.nativeEnum(GraphBuildStatus),
  jobId: z.string(),
  isRebuilding: z.boolean(),
  previousGraphId: z.string().optional(),
  estimatedTimeSeconds: z.number().optional(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const { documentIds } = input;

    ctx.logger.info(`Graph build requested for ${documentIds.length} documents`);

    // Verify user owns all documents
    const ownsAllDocuments = await verifyDocumentOwnership(ctx.userId, documentIds);
    if (!ownsAllDocuments) {
      ctx.logger.error(`User ${ctx.userId} does not own all requested documents`);
      throw new Error('You do not have access to all requested documents');
    }

    // Guard: reject if the user already has a build in flight in ANY
    // non-terminal state. Building alone is not enough: a Pending build is
    // still queued, a Resolving build is mid-ER, and a Cancelling build has a
    // rollback the worker hasn't settled yet — enqueueing over that one is
    // worse than a double build, because the clearGraphCancellation below
    // would delete the very flag the in-flight worker's checkpoints read,
    // silently defeating the cancel.
    const inFlightGraph = await db.graphMetadata.findFirst({
      where: {
        userId: ctx.userId,
        status: {
          in: [
            GraphBuildStatus.Pending,
            GraphBuildStatus.Building,
            GraphBuildStatus.Resolving,
            GraphBuildStatus.Cancelling,
          ],
        },
      },
    });
    if (inFlightGraph) {
      ctx.logger.warn(`Graph build already in progress for user ${ctx.userId}: ${inFlightGraph.graphId} (${inFlightGraph.status})`);
      return {
        graphId: inFlightGraph.graphId,
        status: inFlightGraph.status as GraphBuildStatus,
        jobId: '',
        isRebuilding: false,
      };
    }

    // INCREMENTAL ROUTING — derived from per-document resolved-state, not the
    // graph-level `status: Completed` flag. The flag is destroyed by any build
    // that dies in Resolving/Pending, which used to demote the next build to a
    // whole-corpus re-resolution. Reading which *documents* are already resolved
    // (their Neo4j markers survive a crash) keeps routing incremental instead.
    const resolvedDocIds = await getResolvedDocumentIds(ctx.userId);

    // Find the user's existing graph to extend, regardless of a stuck status — a
    // graph stuck in Resolving/Pending must still be found and reused, never
    // abandoned for a fresh whole-corpus build.
    const existingGraph = await db.graphMetadata.findFirst({
      where: { userId: ctx.userId },
      orderBy: { createdAt: 'desc' },
    });

    const queue = getGraphBuildQueue();
    if (!queue) {
      ctx.logger.error('Graph build queue not available');
      throw new Error('Graph build service is not available');
    }

    // Incremental build: the user already has a graph to extend.
    if (existingGraph) {
      const storedDocIds = existingGraph.documentIds as string[];

      // Validate that stored document IDs still exist (documents may have been deleted)
      const existingDocs = await db.document.findMany({
        where: {
          id: { in: storedDocIds },
          userId: ctx.userId,
        },
        select: { id: true },
      });
      const liveDocIds = existingDocs.map(d => d.id);

      // Log if any documents were cleaned up
      if (liveDocIds.length !== storedDocIds.length) {
        const deletedIds = storedDocIds.filter(id => !liveDocIds.includes(id));
        ctx.logger.warn(`Cleaned up ${deletedIds.length} deleted documents from graph metadata`, { deletedIds });
      }

      // Route EXTRACTION and RESOLUTION independently, each off its own per-document
      // marker. A doc needs EXTRACTION only if it has never been extracted. A doc
      // needs RESOLUTION (ER on) only if it is extracted but not yet resolution-
      // complete. Collapsing these into one "done" set is what made an already-
      // graphed doc get re-routed through the build when only its resolution was
      // pending. Markers are per-document Neo4j state, so a base graph that died
      // mid-extraction never makes its un-extracted docs look done.
      const extractedDocIds = await getExtractedDocumentIds(ctx.userId);
      const extractDocIds = documentIds.filter(id => !extractedDocIds.includes(id));
      const resolveDocIds = (await isEntityResolutionEnabled())
        ? documentIds.filter(id => !resolvedDocIds.includes(id))
        : [];

      // Pending = everything the worker must touch this run. It extracts ONLY
      // `extractDocIds`, so an extracted-but-unresolved doc is resolved without
      // being re-extracted. (Un-extracted docs are a subset of un-resolved docs,
      // so the union is well-formed.)
      const pendingDocIds = Array.from(new Set([...extractDocIds, ...resolveDocIds])).sort();

      ctx.logger.info(`Incremental check: ${extractDocIds.length} to extract, ${resolveDocIds.length} to resolve`);

      if (pendingDocIds.length === 0) {
        // Everything requested is already extracted and (if ER on) resolved.
        ctx.logger.info(`All documents already graphed and resolved, returning existing graph: ${existingGraph.graphId}`);
        return {
          graphId: existingGraph.graphId,
          status: GraphBuildStatus.Completed,
          jobId: '',
          isRebuilding: false,
        };
      }

      // Verify user owns every doc we are about to touch
      const ownsPendingDocs = await verifyDocumentOwnership(ctx.userId, pendingDocIds);
      if (!ownsPendingDocs) {
        throw new Error('You do not have access to all requested documents');
      }

      // Full graph membership = surviving prior membership plus the requested docs
      const allDocumentIds = Array.from(new Set([...liveDocIds, ...documentIds])).sort();

      // Update existing graph status to Building and add new document IDs.
      // A stale errorMessage from a previously settled failure is cleared —
      // this is a fresh attempt.
      await db.graphMetadata.update({
        where: { graphId: existingGraph.graphId },
        data: {
          status: GraphBuildStatus.Building,
          documentIds: allDocumentIds,
          errorMessage: null,
        },
      });

      // A leftover flag from a prior cancel of this same graph must not kill
      // this fresh build.
      await clearGraphCancellation(existingGraph.graphId);

      // Queue the build: extract only the un-extracted docs, resolve the full
      // pending set against the already-resolved base (empty when resolution is
      // off, which is harmless because resolution does not run in that mode).
      const jobId = v4();
      await queue.add('graph-build', {
        graphId: existingGraph.graphId,
        userId: ctx.userId,
        documentIds: pendingDocIds,
        extractDocumentIds: extractDocIds,
        jobId,
        isIncremental: true,
        existingDocumentIds: resolvedDocIds,
        schemaKey: input.schemaKey,
        schemaKeysByDocumentId: input.schemaKeysByDocumentId,
      });

      const estimatedChunks = extractDocIds.length * 20;
      const estimatedTimeSeconds = Math.ceil(estimatedChunks * 0.5);

      ctx.logger.info(`Queued incremental graph build: ${existingGraph.graphId} — ${extractDocIds.length} to extract, ${resolveDocIds.length} to resolve`);

      return {
        graphId: existingGraph.graphId,
        status: GraphBuildStatus.Building,
        jobId,
        isRebuilding: true,
        previousGraphId: existingGraph.graphId,
        estimatedTimeSeconds,
      };
    }

    // No existing graph - create new one (original logic)
    const sortedDocIds = [...documentIds].sort();
    const graphId = `graph_${ctx.userId}_${crypto
      .createHash('sha256')
      .update(sortedDocIds.join(','))
      .digest('hex')
      .substring(0, 16)}`;

    // Check if this exact graph already exists
    const exactGraph = await getGraphMetadata(graphId, ctx.userId);

    if (exactGraph) {
      if (exactGraph.status === GraphBuildStatus.Completed) {
        ctx.logger.info(`Graph already exists and is completed: ${graphId}`);
        return {
          graphId,
          status: GraphBuildStatus.Completed,
          jobId: '',
          isRebuilding: false,
        };
      }

      if (exactGraph.status === GraphBuildStatus.Building) {
        ctx.logger.info(`Graph build already in progress: ${graphId}`);
        return {
          graphId,
          status: GraphBuildStatus.Building,
          jobId: '',
          isRebuilding: false,
        };
      }
    }

    // Create new graph metadata
    await createGraphMetadata({
      userId: ctx.userId,
      documentIds,
    });

    const estimatedChunks = documentIds.length * 20;
    const estimatedTimeSeconds = Math.ceil(estimatedChunks * 0.5);

    // A leftover flag from a prior cancel of this same graphId must not kill
    // this fresh build.
    await clearGraphCancellation(graphId);

    const jobId = v4();
    await queue.add('graph-build', {
      graphId,
      userId: ctx.userId,
      documentIds,
      extractDocumentIds: documentIds, // brand-new graph: every doc needs extraction
      jobId,
      isIncremental: false,
      existingDocumentIds: [],
      schemaKey: input.schemaKey,
      schemaKeysByDocumentId: input.schemaKeysByDocumentId,
    });

    ctx.logger.info(`Queued new graph build: ${graphId} with ${documentIds.length} documents, jobId: ${jobId}`);

    return {
      graphId,
      status: GraphBuildStatus.Pending,
      jobId,
      isRebuilding: false,
      estimatedTimeSeconds,
    };
  });
