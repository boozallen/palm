import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { chatSearchQuery } from '@/features/context-studio/types/chat-search';
import searchChats from '@/features/context-studio/dal/searchChats';

const outputSchema = z.object({
  records: z.array(z.object({
    id: z.string(),
    userName: z.string().nullable(),
    userEmail: z.string().nullable(),
    summary: z.string().nullable(),
    createdAt: z.date(),
    documents: z.array(z.object({
      filename: z.string(),
      citationCount: z.number(),
    })),
    graphDocuments: z.array(z.object({
      filename: z.string(),
      citationCount: z.number(),
    })),
    attachedDocuments: z.array(z.string()),
    artifacts: z.array(z.string()),
    artifactDetails: z.array(z.object({
      name: z.string(),
      cost: z.number().nullable(),
      tokens: z.number().nullable(),
      cumulativeCost: z.number().nullable(),
      cumulativeTokens: z.number().nullable(),
    })),
    messages: z.array(z.object({
      role: z.string(),
      content: z.string(),
      createdAt: z.date(),
      usageSteps: z.array(z.object({
        stepLabel: z.string(),
        cost: z.number(),
        tokens: z.number(),
      })),
    })),
    graphAnchorCitations: z.number(),
  })),
  totalCount: z.number(),
});

export default procedure
  .input(chatSearchQuery)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    return searchChats(input);
  });
