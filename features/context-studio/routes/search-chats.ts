import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { chatSearchQuery } from '@/features/context-studio/types/chat-search';
import searchChats from '@/features/context-studio/dal/searchChats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

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
    sessionLength: z.object({
      totalDurationMs: z.number(),
      visits: z.array(z.object({
        enteredAt: z.date(),
        leftAt: z.date(),
        durationMs: z.number(),
      })),
    }).nullable(),
  })),
  totalCount: z.number(),
  artifactsGeneratedCount: z.number(),
  citedDocumentsCount: z.number(),
  documentCitationsCount: z.number(),
  graphAnchorCitationsCount: z.number(),
});

export default procedure
  .input(chatSearchQuery)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    const { restrictedUserId } = await scopeStudioQuery(ctx, input.userGroupId ?? 'all', input.userId ?? 'all');

    return searchChats({ ...input, userId: restrictedUserId });
  });
