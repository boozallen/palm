import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getCertaPolicies from '@/features/settings/dal/ai-agents/certa/getCertaPolicies';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';

const input = z.object({
  id: z.string().uuid(),
});

const output = z.object({
  policies: z.array(
    z.object({
      id: z.string().uuid(),
      aiAgentId: z.string().uuid(),
      title: z.string(),
      content: z.string(),
      requirements: z.string(),
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

    const policies = await getCertaPolicies(id);

    return {
      policies: policies.map((policy) => ({
        id: policy.id,
        aiAgentId: policy.aiAgentId,
        title: policy.title,
        content: policy.content,
        requirements: policy.requirements,
      })),
    };
  });
