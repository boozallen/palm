import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';
import createWorkflowPrompt from '@/features/workflows/dal/createWorkflowPrompt';
import updateWorkflowPrompt from '@/features/workflows/dal/updateWorkflowPrompt';

export const saveWorkflowPrompt = procedure
  .input(
    z.object({
      promptId: z.string().uuid().optional(),
      instructions: z.string(),
      model: z.string(),
      temperature: z.number().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const hasAccess = await getUserWorkflowsAccess(ctx.userId);
    if (!hasAccess) {
      throw Forbidden('You do not have access to workflows');
    }

    if (input.promptId) {
      await updateWorkflowPrompt(input.promptId, input.instructions);
      return { promptId: input.promptId };
    }

    const { id: promptId } = await createWorkflowPrompt({
      title: 'Workflow Prompt',
      instructions: input.instructions,
      model: input.model,
      temperature: input.temperature ?? 0.7,
      creatorId: ctx.userId,
    });

    return { promptId };
  });
