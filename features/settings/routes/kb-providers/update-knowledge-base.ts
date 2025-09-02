import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import updateKnowledgeBase from '@/features/settings/dal/kb-providers/updateKnowledgeBase';

const inputSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  externalId: z.string(),
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
      throw Forbidden('You do not have permission to update knowledge base');
    }

    const result = await updateKnowledgeBase(input);

    return {
      id: result.id,
      label: result.label,
      externalId: result.externalId,
      kbProviderId: result.kbProviderId,
    };
  });
