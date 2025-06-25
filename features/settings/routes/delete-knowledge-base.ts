import { z } from 'zod';
import { procedure } from '@/server/trpc';
import deleteKnowledgeBase from '@/features/settings/dal/deleteKnowledgeBase';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';

const inputSchema = z.object({
  id: z.string().uuid(),
});

const outputSchema = z.object({
  id: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)

  .mutation(async ({ ctx, input }) => {
    const { id } = input;

    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const result = await deleteKnowledgeBase(id);
    return result;
  });
