import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { ACTIVE_JOB_STATUSES } from '@/features/ai-agents/utils/shared/types';
import getActivePulseJobDal from '@/features/ai-agents/dal/pulse/getActivePulseJob';

const input = z.object({ agentId: z.string().uuid() });

const output = z.object({
  job: z.object({ id: z.string(), status: z.enum(ACTIVE_JOB_STATUSES) }).nullable(),
});

export default procedure
  .input(input)
  .output(output)
  .query(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find((a) => a.id === input.agentId && a.type === AiAgentType.PULSE);

    if (!agent) {
      throw Forbidden('PULSE agent not found or access denied');
    }

    return { job: await getActivePulseJobDal(input.agentId, ctx.userId) };
  });
