import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import updateCertaPolicy from '@/features/settings/dal/ai-agents/certa/updateCertaPolicy';
import { Forbidden } from '@/features/shared/errors/routeErrors';

const inputSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  requirements: z.string(),
});

const outputSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  requirements: z.string(),
  aiAgentId: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to update a policy');
    }

    const result = await updateCertaPolicy(input);

    return result;
  });
