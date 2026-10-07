import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import getActiveOdramJob from '@/features/ai-agents/dal/odram/getActiveOdramJob';

const input = z.object({
  agentId: z.string().uuid(),
});

const output = z.object({
  job: z.object({
    id: z.string(),
    status: z.string(),
    odramFilename: z.string(),
  }).nullable(),
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

    const job = await getActiveOdramJob(input.agentId, ctx.userId);

    if (!job) {
      return { job: null };
    }

    return {
      job: {
        id: job.id,
        status: job.status,
        odramFilename: job.odramFilename,
      },
    };
  });
