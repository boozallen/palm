import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getSwearChecklistItems from '@/features/settings/dal/ai-agents/swear/getSwearChecklistItems';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';

const input = z.object({
  id: z.string().uuid(),
});

const output = z.object({
  checklistItems: z.array(
    z.object({
      id: z.string().uuid(),
      aiAgentId: z.string().uuid(),
      category: z.string(),
      item: z.string(),
      sortOrder: z.number(),
    })
  ),
});

export default procedure
  .input(input)
  .output(output)
  .query(async ({ ctx, input }) => {
    const { id } = input;

    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const checklistItems = await getSwearChecklistItems(id);

    return {
      checklistItems: checklistItems.map((item) => ({
        id: item.id,
        aiAgentId: item.aiAgentId,
        category: item.category,
        item: item.item,
        sortOrder: item.sortOrder,
      })),
    };
  });
