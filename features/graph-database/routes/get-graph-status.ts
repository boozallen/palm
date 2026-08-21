import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { GraphBuildStatus } from '@/features/graph-database/types';
import getGraphMetadata from '@/features/graph-database/dal/getGraphMetadata';

const inputSchema = z.object({
  graphId: z.string(),
});

const outputSchema = z.object({
  graphId: z.string(),
  status: z.nativeEnum(GraphBuildStatus),
  progress: z.number().optional(), // 0-100
  errorMessage: z.string().optional(),
  completedAt: z.date().optional(),
  totalChunks: z.number().optional(),
  processedChunks: z.number().optional(),
  currentStep: z.string().optional(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    const graph = await getGraphMetadata(input.graphId, ctx.userId);

    if (!graph) {
      ctx.logger.error(`[GRAPH-STATUS] Graph not found or access denied: ${input.graphId}`);
      throw new Error('Graph not found or you do not have permission to access it');
    }

    let progress: number | undefined;
    let totalChunks: number | undefined;
    let processedChunks: number | undefined;
    let currentStep: string | undefined;

    if (graph.buildProgress) {
      const buildProgress = graph.buildProgress as any;
      totalChunks = buildProgress.totalChunks;
      processedChunks = buildProgress.processedChunks;
      currentStep = buildProgress.currentStep;

      if (totalChunks && totalChunks > 0 && processedChunks !== undefined) {
        progress = Math.round((processedChunks / totalChunks) * 100);
      }
    }

    const result = {
      graphId: graph.graphId,
      status: graph.status,
      progress,
      errorMessage: graph.errorMessage || undefined,
      completedAt: graph.completedAt || undefined,
      totalChunks,
      processedChunks,
      currentStep,
    };

    ctx.logger.debug(`[GRAPH-STATUS] Returning status for ${input.graphId}: ${graph.status}`);

    return result;
  });
