import getUserPreselectedKnowledgeBases from '@/features/shared/dal/getUserPreselectedKnowledgeBases';
import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Unauthorized } from '@/features/shared/errors/routeErrors';

const outputSchema = z.object({
  userPreselectedKnowledgeBases: z.array(
    z.object({
      id: z.string().uuid(),
    })
  ),
});

export type UserPreselectedKnowledgeBases = z.infer<typeof outputSchema>;

export default procedure.output(outputSchema).query(async ({ ctx }) => {
  const userId = ctx.userId;
  if (!userId) {
    throw Unauthorized('You do not have permission to access this resource');
  }

  const knowledgeBases = await getUserPreselectedKnowledgeBases(userId);

  const output: UserPreselectedKnowledgeBases = {
    userPreselectedKnowledgeBases:
      knowledgeBases.userPreselectedKnowledgeBases.map((knowledgeBase) => {
        return { id: knowledgeBase.id };
      }),
  };

  return output;
});
