import { z } from 'zod';
import { procedure } from '@/server/trpc';
import getIsUserGroupLead from '@/features/shared/dal/getIsUserGroupLead';

const outputSchema = z.object({
  isUserGroupLead: z.boolean(),
});

export default procedure.output(outputSchema).query(async ({ ctx }) => {
  const { userId } = ctx;
  const result = await getIsUserGroupLead(userId);
  const output: z.infer<typeof outputSchema> = {
    isUserGroupLead: result,
  };
  return output;
});
