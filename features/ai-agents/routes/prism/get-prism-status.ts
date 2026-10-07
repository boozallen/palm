import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { storage } from '@/server/storage/redis';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';

const input = z.object({
  agentId: z.string().uuid(),
  jobId: z.string().uuid(),
});

const output = z.object({
  status: z.enum(['queued', 'processing', 'completed', 'error']),
  progress: z.string().optional(),
  error: z.string().optional(),
});

export const getPrismStatus = procedure
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

    const jobData = await storage.hgetall(`prism-job:${input.jobId}`);

    if (!jobData || !jobData.status) {
      throw new Error('Job not found');
    }

    const status = jobData.status as 'queued' | 'processing' | 'completed' | 'error';

    return {
      status,
      progress: jobData.progress,
      error: jobData.error,
    };
  });
