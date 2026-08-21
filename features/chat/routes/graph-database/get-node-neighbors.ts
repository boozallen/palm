import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { getNodeNeighbors } from '@/features/graph-database/dal/getNodeNeighbors';
import assertDocumentAccess from '@/features/shared/utils/assertDocumentAccess';

const inputSchema = z.object({
  documentIds: z.array(z.string()).min(1, 'At least one document ID is required'),
  nodeNeoId: z.number().int().nonnegative('Node ID must be a non-negative integer'),
});

const nodeSchema = z.object({
  id: z.number(),
  label: z.string(),
  labels: z.array(z.string()),
  properties: z.record(z.any()),
  group: z.string(),
});

const edgeSchema = z.object({
  from: z.number(),
  to: z.number(),
  label: z.string(),
  type: z.string(),
  properties: z.record(z.any()),
});

const outputSchema = z.object({
  success: z.boolean(),
  sourceNode: nodeSchema,
  neighbors: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  metadata: z.object({
    sourceNodeId: z.number(),
    neighborCount: z.number(),
    edgeCount: z.number(),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    const { documentIds, nodeNeoId } = input;
    const userId = ctx.userId!;

    await assertDocumentAccess(ctx, documentIds);

    ctx.logger.debug(
      `[CHAT-NODE-NEIGHBORS] Getting neighbors for node ${nodeNeoId}, user ${userId}, documents: ${documentIds.join(',')}`
    );

    try {
      const result = await getNodeNeighbors({
        documentIds,
        nodeNeoId,
      });

      ctx.logger.debug(
        `[CHAT-NODE-NEIGHBORS] Found ${result.neighbors.length} neighbors for node ${nodeNeoId}`
      );

      return {
        success: true,
        sourceNode: result.sourceNode,
        neighbors: result.neighbors,
        edges: result.edges,
        metadata: result.metadata,
      };
    } catch (error) {
      ctx.logger.error(`[CHAT-NODE-NEIGHBORS] Error getting neighbors for node ${nodeNeoId}:`, error);
      throw new Error(`Failed to get node neighbors: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
