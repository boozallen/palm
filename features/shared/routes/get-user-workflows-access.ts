import { z } from 'zod';
import { procedure } from '@/server/trpc';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';

const outputSchema = z.object({
  hasAccess: z.boolean(),
});

export default procedure
  .output(outputSchema)
  .query(async ({ ctx }) => {
    const result = await getUserWorkflowsAccess(ctx.userId);
    
    return {
      hasAccess: result,
    };
  });