import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { NotFound, Forbidden } from '@/features/shared/errors/routeErrors';
import getUserGroups from '@/features/profile/dal/getUserGroups';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';
import copyWorkflow from '@/features/workflows/dal/copyWorkflow';
import db from '@/server/db';

const inputSchema = z.object({
  workflowId: z.string().uuid(),
});

const outputSchema = z.object({
  copiedWorkflowId: z.string(),
  workflowName: z.string(),
});

export const copyWorkflowRoute = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const hasAccess = await getUserWorkflowsAccess(ctx.userId);
    if (!hasAccess) {
      throw Forbidden('You do not have access to workflows');
    }

    const workflow = await db.workflow.findUnique({
      where: { id: input.workflowId, deletedAt: null },
    });

    if (!workflow) {
      throw NotFound('Workflow not found');
    }

    const userGroups = await getUserGroups(ctx.userId);
    const userGroupIds = userGroups.map((g) => g.id);

    return copyWorkflow({
      workflowId: input.workflowId,
      userId: ctx.userId,
      userGroupIds,
    });
  });
