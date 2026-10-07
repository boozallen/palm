import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { workflowArtifactSearchQuery } from '@/features/context-studio/types/chat-search';
import searchWorkflowArtifacts from '@/features/context-studio/dal/searchWorkflowArtifacts';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const outputSchema = z.object({
  records: z.array(z.object({
    id: z.string(),
    name: z.string(),
    workflowName: z.string().nullable(),
    userName: z.string().nullable(),
    createdAt: z.date(),
    cost: z.number().nullable(),
    tokens: z.number().nullable(),
    cumulativeCost: z.number().nullable(),
    cumulativeTokens: z.number().nullable(),
  })),
  totalCount: z.number(),
});

export default procedure
  .input(workflowArtifactSearchQuery)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    const { restrictedUserId } = await scopeStudioQuery(ctx, input.userGroupId ?? 'all', input.userId ?? 'all');

    return searchWorkflowArtifacts({ ...input, userId: restrictedUserId });
  });
