import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { getChatNetwork } from '@/features/graph-database/dal/getChatNetwork';
import { GraphNodeLimits } from '@/features/graph-database/types';
import assertDocumentAccess from '@/features/shared/utils/assertDocumentAccess';

const inputSchema = z.object({
  documentIds: z.array(z.string()).min(1, 'At least one document ID is required'),
  limit: z.number().optional().default(GraphNodeLimits.MAX),
  labels: z.array(z.string()).optional().default([]),
  relationships: z.array(z.string()).optional().default([]),
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
  network: z.object({
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema),
  }),
  metadata: z.object({
    nodeCount: z.number(),
    edgeCount: z.number(),
    limit: z.number(),
    documentIds: z.array(z.string()),
    filters: z.object({
      labels: z.array(z.string()),
      relationships: z.array(z.string()),
    }),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    const { documentIds, limit: rawLimit, labels, relationships } = input;
    const limit = Math.min(rawLimit, GraphNodeLimits.MAX);
    const userId = ctx.userId!; // This is a protected route requiring authentication

    await assertDocumentAccess(ctx, documentIds);

    ctx.logger.debug(`[CHAT-GRAPH-NETWORK] Getting network data for user ${userId}, documents: ${documentIds.join(',')}, limit: ${limit}`);

    try {
      const result = await getChatNetwork({
        documentIds,
        limit,
        labels,
        relationships,
      });

      const response = {
        success: true,
        network: {
          nodes: result.nodes,
          edges: result.edges,
        },
        metadata: result.metadata,
      };

      ctx.logger.debug(`[CHAT-GRAPH-NETWORK] Returning ${result.nodes.length} nodes and ${result.edges.length} edges for user ${userId}`);
      return response;
    } catch (error) {
      ctx.logger.error(`[CHAT-GRAPH-NETWORK] Error querying chat network for user ${userId}:`, error);
      throw new Error(`Failed to query chat network: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });