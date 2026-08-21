import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { getNodeNeighborCount } from '@/features/graph-database/dal/getNodeNeighborCount';
import assertDocumentAccess from '@/features/shared/utils/assertDocumentAccess';

const inputSchema = z.object({
  documentIds: z.array(z.string()).min(1, 'At least one document ID is required'),
  nodeNeoId: z.number().int().nonnegative('Node ID must be a non-negative integer'),
});

const outputSchema = z.object({
  totalNeighbors: z.number(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    const { documentIds, nodeNeoId } = input;

    await assertDocumentAccess(ctx, documentIds);

    try {
      const result = await getNodeNeighborCount({
        documentIds,
        nodeNeoId,
      });

      return result;
    } catch (error) {
      ctx.logger.error(`[CHAT-NODE-NEIGHBOR-COUNT] Error counting neighbors for node ${nodeNeoId}:`, error);
      throw new Error(`Failed to count node neighbors: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
