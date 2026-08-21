import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { findShortestPathBetweenNodes } from '@/features/graph-database/dal/findShortestPathBetweenNodes';
import assertDocumentAccess from '@/features/shared/utils/assertDocumentAccess';

const inputSchema = z.object({
  documentIds: z.array(z.string()).min(1, 'At least one document ID is required'),
  nodeNeoIds: z.array(z.number().int().nonnegative()).min(2).max(20),
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
  paths: z.array(
    z.object({
      startNeoId: z.number(),
      endNeoId: z.number(),
      nodes: z.array(nodeSchema),
      edges: z.array(edgeSchema),
    }),
  ),
  noPathPairs: z.array(
    z.object({
      startNeoId: z.number(),
      endNeoId: z.number(),
    }),
  ),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    const { documentIds, nodeNeoIds } = input;
    const userId = ctx.userId!;

    await assertDocumentAccess(ctx, documentIds);

    ctx.logger.debug(
      `[CHAT-SHORTEST-PATH] Finding paths between ${nodeNeoIds.length} nodes, user ${userId}`,
    );

    try {
      const result = await findShortestPathBetweenNodes({
        documentIds,
        nodeNeoIds,
      });

      ctx.logger.debug(
        `[CHAT-SHORTEST-PATH] Found ${result.paths.length} paths, ${result.noPathPairs.length} no-path pairs`,
      );

      return result;
    } catch (error) {
      ctx.logger.error('[CHAT-SHORTEST-PATH] Error finding shortest paths:', error);
      throw new Error(
        `Failed to find shortest paths: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  });
