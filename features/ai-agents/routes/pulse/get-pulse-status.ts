import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { storage } from '@/server/storage/redis';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { JOB_STATUSES, isJobStatus } from '@/features/ai-agents/utils/shared/types';
import getPulseJobStatus from '@/features/ai-agents/dal/pulse/getPulseJobStatus';

const input = z.object({
  agentId: z.string().uuid(),
  jobId: z.string().uuid(),
});

const output = z.object({
  status: z.enum(JOB_STATUSES),
  progress: z.string().nullable(),
  error: z.string().nullable(),
});

export const getPulseStatus = procedure
  .input(input)
  .output(output)
  .query(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find((a) => a.id === input.agentId && a.type === AiAgentType.PULSE);

    if (!agent) {
      throw Forbidden('PULSE agent not found or access denied');
    }

    const job = await getPulseJobStatus(input.jobId, ctx.userId, input.agentId);

    if (!job) {
      throw NotFound('PULSE job not found');
    }

    const record = await storage.hgetall(`pulse-job:${input.jobId}`);

    if (record && Object.keys(record).length > 0) {
      // Redis is a plain hash, so its status is only trusted when it is one the app writes.
      return {
        status: isJobStatus(record.status) ? record.status : job.status,
        progress: record.progress ?? null,
        error: record.error ?? null,
      };
    }

    return {
      status: job.status,
      progress: null,
      error: job.errorMessage,
    };
  });
