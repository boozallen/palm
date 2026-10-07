import { z } from 'zod';
import { procedure } from '@/server/trpc';
import getUserAgenticChatAccess from '@/features/shared/dal/getUserAgenticChatAccess';

const outputSchema = z.object({
  hasAccess: z.boolean(),
});

export default procedure
  .output(outputSchema)
  .query(async ({ ctx }) => {
    const result = await getUserAgenticChatAccess(ctx.userId);

    return {
      hasAccess: result,
    };
  });
