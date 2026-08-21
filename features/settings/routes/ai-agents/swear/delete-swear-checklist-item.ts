import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import deleteSwearChecklistItem from '@/features/settings/dal/ai-agents/swear/deleteSwearChecklistItem';
import { Forbidden } from '@/features/shared/errors/routeErrors';

const inputSchema = z.object({
  itemId: z.string().uuid(),
});

const outputSchema = z.object({
  id: z.string().uuid(),
  aiAgentId: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { itemId } = input;

    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const result = await deleteSwearChecklistItem(itemId);

    return {
      id: result.id,
      aiAgentId: result.aiAgentId,
    };
  });
