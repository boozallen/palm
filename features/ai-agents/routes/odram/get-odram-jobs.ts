import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import getOdramJobs from '@/features/ai-agents/dal/odram/getOdramJobs';

const input = z.object({
  agentId: z.string().uuid(),
});

const jobSchema = z.object({
  id: z.string(),
  status: z.string(),
  odramFilename: z.string(),
  createdAt: z.date(),
});

const output = z.object({
  jobs: z.array(jobSchema),
});

export default procedure
  .input(input)
  .output(output)
  .query(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find(
      (a) => a.id === input.agentId && a.type === AiAgentType.ODRAM,
    );

    if (!agent) {
      throw new Error('ODRAM agent not found or access denied');
    }

    const jobs = await getOdramJobs(input.agentId, ctx.userId);

    return { jobs };
  });
