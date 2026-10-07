import { z } from 'zod';

import getUserGroups from '@/features/profile/dal/getUserGroups';
import { procedure } from '@/server/trpc';
import { UserGroupRole } from '@/features/shared/types/user-group';

const outputSchema = z.object({
  userGroups: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string(),
      role: z.nativeEnum(UserGroupRole),
      aiProviderIds: z.array(z.string().uuid()),
      workflowsEnabled: z.boolean(),
    })
  ),
});

export default procedure.output(outputSchema).query(async ({ ctx }) => {
  const { userId } = ctx;
  const results = await getUserGroups(userId);
  return {
    userGroups: results.map(({ id, label, role, aiProviderIds, workflowsEnabled }) => ({ id, label, role, aiProviderIds, workflowsEnabled })),
  };
});
