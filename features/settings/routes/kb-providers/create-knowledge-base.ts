import { z } from 'zod';

import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { procedure } from '@/server/trpc';
import createKnowledgeBase from '@/features/settings/dal/kb-providers/createKnowledgeBase';

const inputSchema = z.object({
  label: z.string(),
  externalId: z.string(),
  kbProviderId: z.string().uuid(),
});

const outputSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  externalId: z.string(),
  kbProviderId: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {

    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const result = await createKnowledgeBase(input);

    return {
      id: result.id,
      label: result.label,
      externalId: result.externalId,
      kbProviderId: result.kbProviderId,
    };
  });
