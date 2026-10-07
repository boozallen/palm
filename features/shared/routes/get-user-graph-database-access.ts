import { z } from 'zod';
import { procedure } from '@/server/trpc';
import getUserGraphDatabaseAccess from '@/features/shared/dal/getUserGraphDatabaseAccess';

const outputSchema = z.object({
  hasAccess: z.boolean(),
});

export default procedure
  .output(outputSchema)
  .query(async ({ ctx }) => {
    const result = await getUserGraphDatabaseAccess(ctx.userId);
    
    return {
      hasAccess: result,
    };
  });