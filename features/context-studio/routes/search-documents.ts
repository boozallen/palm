import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { documentSearchQuery } from '@/features/context-studio/types/chat-search';
import searchDocuments from '@/features/context-studio/dal/searchDocuments';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const outputSchema = z.object({
  records: z.array(z.object({
    id: z.string(),
    filename: z.string(),
    userName: z.string().nullable(),
    userEmail: z.string().nullable(),
    createdAt: z.date(),
    type: z.string().nullable(),
    summary: z.string().nullable(),
  })),
  totalCount: z.number(),
  typeCounts: z.record(z.string(), z.number()),
});

export default procedure
  .input(documentSearchQuery)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    const { restrictedUserId } = await scopeStudioQuery(ctx, input.userGroupId ?? 'all', input.userId ?? 'all');

    return searchDocuments({ ...input, userId: restrictedUserId });
  });
