import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import deleteWorkflowRecord from '@/features/workflows/dal/deleteWorkflow';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';

const inputSchema = z.object({
  workflowId: z.string().uuid(),
});

const outputSchema = z.object({
  id: z.string().uuid(),
});

export const deleteWorkflow = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { workflowId } = input;

    const hasAccess = await getUserWorkflowsAccess(ctx.userId);
    if (!hasAccess) {
      throw Forbidden('You do not have access to workflows');
    }

    try {
      const result = await deleteWorkflowRecord(workflowId, ctx.userId);
      return { id: result.id };
    } catch (error) {
      throw new Error(`Error deleting workflow: ${(error as Error).message}`);
    }
  });