import { z } from 'zod';

import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { procedure } from '@/server/trpc';
import createSwearChecklistItem from '@/features/settings/dal/ai-agents/swear/createSwearChecklistItem';

const input = z.object({
  aiAgentId: z.string().uuid(),
  category: z.string(),
  item: z.string(),
  sortOrder: z.number(),
});

const output = z.object({
  id: z.string().uuid(),
  aiAgentId: z.string().uuid(),
  category: z.string(),
  item: z.string(),
  sortOrder: z.number(),
});

export default procedure
  .input(input)
  .output(output)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have access to this resource');
    }

    const checklistItem = await createSwearChecklistItem(input);

    return {
      id: checklistItem.id,
      aiAgentId: checklistItem.aiAgentId,
      category: checklistItem.category,
      item: checklistItem.item,
      sortOrder: checklistItem.sortOrder,
    };
  });
