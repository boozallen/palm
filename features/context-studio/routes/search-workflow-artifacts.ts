import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { workflowArtifactSearchQuery } from '@/features/context-studio/types/chat-search';
import searchWorkflowArtifacts from '@/features/context-studio/dal/searchWorkflowArtifacts';

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
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    return searchWorkflowArtifacts(input);
  });
