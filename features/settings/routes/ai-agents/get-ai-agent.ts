import { procedure } from '@/server/trpc';
import { z } from 'zod';
import getAiAgent from '@/features/settings/dal/ai-agents/getAiAgent';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';

const input = z.object({
  id: z.string().uuid(),
});

const output = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
});

export default procedure
  .input(input)
  .output(output)
  .query(async ({ ctx, input }) => {

    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const agent = await getAiAgent(input.id);

    return {
      id: agent.id,
      name: agent.name,
      description: agent.description,
    };
  });
