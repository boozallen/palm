import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { getEdgesBetween } from '@/features/graph-database/dal/getEdgesBetween';
import assertDocumentAccess from '@/features/shared/utils/assertDocumentAccess';

const inputSchema = z.object({
  documentIds: z.array(z.string()).min(1, 'At least one document ID is required'),
  newNodeNeoIds: z.array(z.number().int()),
  existingNodeNeoIds: z.array(z.number().int()),
});

const edgeSchema = z.object({
  from: z.number(),
  to: z.number(),
  label: z.string(),
  type: z.string(),
  properties: z.record(z.any()),
});

const outputSchema = z.object({
  edges: z.array(edgeSchema),
  metadata: z.object({
    edgeCount: z.number(),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    await assertDocumentAccess(ctx, input.documentIds);

    ctx.logger.debug(
      `[GRAPH-EDGES-BETWEEN] Fetching cross-edges: ${input.newNodeNeoIds.length} new × ${input.existingNodeNeoIds.length} existing nodes`
    );

    try {
      const result = await getEdgesBetween({
        documentIds: input.documentIds,
        newNodeNeoIds: input.newNodeNeoIds,
        existingNodeNeoIds: input.existingNodeNeoIds,
      });

      ctx.logger.debug(
        `[GRAPH-EDGES-BETWEEN] Found ${result.edges.length} cross-edges`
      );

      return result;
    } catch (error) {
      ctx.logger.error('[GRAPH-EDGES-BETWEEN] Error fetching cross-edges:', error);
      throw new Error('Failed to fetch edges between nodes');
    }
  });
