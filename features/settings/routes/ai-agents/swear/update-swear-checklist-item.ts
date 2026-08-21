import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import updateSwearChecklistItem from '@/features/settings/dal/ai-agents/swear/updateSwearChecklistItem';
import { Forbidden } from '@/features/shared/errors/routeErrors';

const inputSchema = z.object({
  id: z.string().uuid(),
  category: z.string(),
  item: z.string(),
  sortOrder: z.number(),
});

const outputSchema = z.object({
  id: z.string().uuid(),
  category: z.string(),
  item: z.string(),
  sortOrder: z.number(),
  aiAgentId: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to update a checklist item');
    }

    const result = await updateSwearChecklistItem(input);

    return result;
  });
