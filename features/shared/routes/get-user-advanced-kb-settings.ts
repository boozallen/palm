import { z } from 'zod';

import getAdvancedKbSettings from '@/features/shared/dal/getUserAdvancedKbSettings';
import { procedure } from '@/server/trpc';
import { Unauthorized } from '@/features/shared/errors/routeErrors';

const outputSchema = z.object({
  knowledgeBasesMinScore: z.number().nullable(),
  knowledgeBasesMaxResults: z.number().nullable(),

});

export default procedure.output(outputSchema).query(async ({ ctx }) => {
  const { userId } = ctx;

  if (!userId) {
    throw Unauthorized('You do not have permission to access this resource');
  }

  const results = await getAdvancedKbSettings(userId);

  return {
    knowledgeBasesMinScore: results.knowledgeBasesMinScore,
    knowledgeBasesMaxResults: results.knowledgeBasesMaxResults,
  };
});
