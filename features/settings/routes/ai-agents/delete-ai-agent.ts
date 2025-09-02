import { z } from 'zod';

import { AiAgentType } from '@/features/shared/types';
import { procedure } from '@/server/trpc';
import deleteAiAgent from '@/features/settings/dal/ai-agents/deleteAiAgent';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';

const input = z.object({
  agentId: z.string().uuid(),
});

const output = z.object({
  id: z.string().uuid(),
  label: z.string(),
  description: z.string().nullable(),
  type: z.nativeEnum(AiAgentType),
});

export default procedure
  .input(input)
  .output(output)
  .mutation(async ({ ctx, input }) => {
    const { agentId } = input;

    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const result = await deleteAiAgent(agentId);

    // Note: result.label maps to database field 'name' for consistency with UI naming convention
    return {
      id: result.id,
      label: result.label,
      description: result.description,
      type: result.type,
    };
  });
