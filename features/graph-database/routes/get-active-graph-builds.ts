import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { GraphBuildStatus } from '@/features/graph-database/types';
import getActiveGraphBuilds from '@/features/graph-database/dal/getActiveGraphBuilds';

const outputSchema = z.array(z.object({
  graphId: z.string(),
  documentIds: z.array(z.string()),
  newDocumentIds: z.array(z.string()).optional(),
  status: z.nativeEnum(GraphBuildStatus),
  progress: z.number().optional(),
  currentStep: z.string().optional(),
  createdAt: z.string(),
  totalChunks: z.number().optional(),
  processedChunks: z.number().optional(),
}));

export default procedure
  .output(outputSchema)
  .query(async ({ ctx }) => {
    const activeBuilds = await getActiveGraphBuilds(ctx.userId);

    ctx.logger.debug(`[ACTIVE-GRAPH-BUILDS] Found ${activeBuilds.length} active builds for user ${ctx.userId}`);

    return activeBuilds.map((build) => ({
      ...build,
      createdAt: build.createdAt.toISOString(),
    }));
  });