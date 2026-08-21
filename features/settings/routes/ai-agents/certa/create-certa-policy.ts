import { z } from 'zod';

import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { procedure } from '@/server/trpc';
import createCertaPolicy from '@/features/settings/dal/ai-agents/certa/createCertaPolicy';

const input = z.object({
  aiAgentId: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  requirements: z.string(),
});

const output = z.object({
  id: z.string().uuid(),
  aiAgentId: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  requirements: z.string(),
});

export default procedure
  .input(input)
  .output(output)
  .mutation(async ({ ctx, input }) => {;

    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have access to this resource');
    }

    const policy = await createCertaPolicy(input);

    return {
      id: policy.id,
      aiAgentId: policy.aiAgentId,
      title: policy.title,
      content: policy.content,
      requirements: policy.requirements,
    };
  });
