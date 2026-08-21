import { z } from 'zod';

import getUserEnabledAiAgents from '@/features/shared/dal/getUserEnabledAiAgents';
import { procedure } from '@/server/trpc';
import { Unauthorized } from '@/features/shared/errors/routeErrors';

const outputSchema = z.object({
  enabledAiAgents: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string(),
      description: z.string(),
    })
  ),
});

type GetUserEnabledAiAgentsOutput = z.infer<typeof outputSchema>;

export default procedure.output(outputSchema).query(async ({ ctx }) => {
  if (!ctx.userId) {
    throw Unauthorized('You do not have permission to access this resource');
  }
  
  const enabledAiAgents = await getUserEnabledAiAgents(ctx.userId);

  // Note: agent.label maps to database field 'name' for consistency with UI naming convention
  const output: GetUserEnabledAiAgentsOutput = {
    enabledAiAgents: enabledAiAgents.map((agent) => ({
      id: agent.id,
      label: agent.label,
      description: agent.description,
    })),
  };

  return output;
});
