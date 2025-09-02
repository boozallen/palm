import updateUserPreselectedKnowledgeBases from '@/features/profile/dal/updateUserPreselectedKnowledgeBases';
import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Unauthorized } from '@/features/shared/errors/routeErrors';

const inputSchema = z.object({
  knowledgeBaseId: z.string().uuid(),
  preselected: z.boolean(),
});

const outputSchema = z.object({
  knowledgeBases: z.array(
    z.object({
      id: z.string().uuid(),
    })
  ),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input: { knowledgeBaseId, preselected }, ctx }) => {
    const userId = ctx.userId;

    if (!userId) {
      throw Unauthorized('You do not have permission to access this resource');
    }

    const updatedKnowledgeBases = await updateUserPreselectedKnowledgeBases(
      userId,
      knowledgeBaseId,
      preselected
    );
    const output: z.infer<typeof outputSchema> = {
      knowledgeBases: updatedKnowledgeBases.map((knowledgeBase) => {
        return { id: knowledgeBase.id };
      }),
    };
    return output;
  });
