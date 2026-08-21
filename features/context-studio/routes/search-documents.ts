import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { documentSearchQuery } from '@/features/context-studio/types/chat-search';
import searchDocuments from '@/features/context-studio/dal/searchDocuments';

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
});

export default procedure
  .input(documentSearchQuery)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    return searchDocuments(input);
  });
