import { z } from 'zod';

import getUserKnowledgeBases from '@/features/shared/dal/getUserKnowledgeBases';
import { procedure } from '@/server/trpc';
import { Unauthorized } from '@/features/shared/errors/routeErrors';

const outputSchema = z.object({
  userKnowledgeBases: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string(),
      kbProviderId: z.string().uuid(),
      kbProviderLabel: z.string(),
    })
  ),
});

type GetUserKnowledgeBasesOutput = z.infer<typeof outputSchema>;

export default procedure.output(outputSchema).query(async ({ ctx }) => {
  if (!ctx.userId) {
    throw Unauthorized('You do not have permission to access this resource');
  }
  const knowledgeBases = await getUserKnowledgeBases(ctx.userId);

  const output: GetUserKnowledgeBasesOutput = {
    userKnowledgeBases: knowledgeBases.map((knowledgeBase) => ({
      id: knowledgeBase.id,
      label: knowledgeBase.label,
      kbProviderId: knowledgeBase.kbProviderId,
      kbProviderLabel: knowledgeBase.kbProviderLabel,
    })),
  };

  return output;
});
