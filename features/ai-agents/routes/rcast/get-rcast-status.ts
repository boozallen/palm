import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { storage } from '@/server/storage/redis';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { Forbidden } from '@/features/shared/errors/routeErrors';

export const getRcastStatus = procedure
  .input(z.object({ agentId: z.string().uuid(), jobId: z.string() }))
  .query(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find(
      (agent) => agent.id === input.agentId && agent.type === AiAgentType.RCAST
    );

    if (!agent) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const job = await storage.hgetall(`rcast-job:${input.jobId}`);

    if (!job.status) {
      throw new Error('Job not found');
    }

    return {
      status: job.status as string,
      progress: job.progress as string,
      created: job.created as string,
      completed: job.completed ? (job.completed as string) : null,
      error: job.error ? (job.error as string) : null,
    };
  });
