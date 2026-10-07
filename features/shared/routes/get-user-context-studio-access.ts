import { z } from 'zod';
import { procedure } from '@/server/trpc';
import getUserContextStudioAccess from '@/features/shared/dal/getUserContextStudioAccess';

const outputSchema = z.object({
  hasAccess: z.boolean(),
});

export default procedure
  .output(outputSchema)
  .query(async ({ ctx }) => {
    const result = await getUserContextStudioAccess(ctx.userId);

    return {
      hasAccess: result,
    };
  });
