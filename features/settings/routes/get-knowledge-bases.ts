import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getKnowledgeBases from '@/features/shared/dal/getKnowledgeBases';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import getIsUserGroupLead from '@/features/shared/dal/getIsUserGroupLead';

const outputSchema = z.object({
  knowledgeBases: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      externalId: z.string(),
      kbProviderId: z.string(),
    })
  ),
});

export default procedure.output(outputSchema).query(async ({ ctx }) => {
  if (ctx.userRole !== UserRole.Admin) {
    const lead = await getIsUserGroupLead(ctx.userId);
    if (!lead) {
      throw Forbidden('You do not have permission to access this resource');
    }
  }

  const records = await getKnowledgeBases();

  const result: z.infer<typeof outputSchema> = {
    knowledgeBases: records.map((record) => ({
      id: record.id,
      label: record.label,
      externalId: record.externalId,
      kbProviderId: record.kbProviderId,
    })),
  };

  return result;
});
