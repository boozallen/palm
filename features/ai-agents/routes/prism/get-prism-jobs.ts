import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import getPrismJobs from '@/features/ai-agents/dal/prism/getPrismJobs';

const input = z.object({
  agentId: z.string().uuid(),
});

const jobSchema = z.object({
  id: z.string(),
  status: z.string(),
  requirementsFilename: z.string(),
  proposalFilename: z.string(),
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
      (a) => a.id === input.agentId && a.type === AiAgentType.PRISM,
    );

    if (!agent) {
      throw new Error('PRISM agent not found or access denied');
    }

    const jobs = await getPrismJobs(input.agentId, ctx.userId);

    return { jobs };
  });
