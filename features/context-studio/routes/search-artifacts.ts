import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { artifactSearchQuery } from '@/features/context-studio/types/artifact-search';
import searchArtifacts from '@/features/context-studio/dal/searchArtifacts';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const outputSchema = z.object({
  records: z.array(z.object({
    id: z.string(),
    name: z.string(),
    source: z.enum(['chat', 'workflow']),
    userName: z.string().nullable(),
    workflowName: z.string().nullable(),
    createdAt: z.date(),
    cost: z.number().nullable(),
    tokens: z.number().nullable(),
    cumulativeCost: z.number().nullable(),
    cumulativeTokens: z.number().nullable(),
    sizeBytes: z.number().nullable(),
  })),
  totalCount: z.number(),
  typeCounts: z.record(z.string(), z.number()),
});

export default procedure
  .input(artifactSearchQuery)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    const { restrictedUserId } = await scopeStudioQuery(ctx, input.userGroupId ?? 'all', input.userId ?? 'all');

    return searchArtifacts({ ...input, userId: restrictedUserId });
  });
