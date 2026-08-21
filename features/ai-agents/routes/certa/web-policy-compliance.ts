import { z } from 'zod';
import crypto from 'crypto';

import { storage } from '@/server/storage/redis';
import { procedure } from '@/server/trpc';
import { startCertaWorker as startWorker } from '@/features/ai-agents/utils/certa/worker/worker';
import { getCertaQueue } from '@/features/ai-agents/utils/certa/worker/queue';
import logger from '@/server/logger';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { Forbidden } from '@/features/shared/errors/routeErrors';

startWorker().catch((err) => {
  if (!err.message.includes('Worker is already running')) {
    logger.error('Failed to start worker:', err);
  }
});

export const webPolicyCompliance = procedure
  .input(
    z.object({
      agentId: z.string().uuid(),
      url: z.string().url(),
      model: z.string().uuid(),
      policies: z.array(
        z.object({
          title: z.string(),
          content: z.string(),
          requirements: z.string(),
        })
      ),
      instructions: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {

    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find(agent => agent.id === input.agentId && agent.type === AiAgentType.CERTA);

    if (!agent) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const jobId = crypto.randomUUID();

    await storage.hset(`certa-job:${jobId}`, {
      status: 'processing',
      url: input.url,
      created: Date.now(),
    });

    const queue = getCertaQueue();
    if (!queue) {
      logger.warn('CERTA queue is not initialized — job not queued.');
      throw new Error('CERTA agent is not available at this time.');
    }
    await queue.add('complianceJob', {
      ...input,
      jobId,
      userId: ctx.userId,
    });

    // Return jobId immediately
    return { jobId };
  });

export const getComplianceStatus = procedure
  .input(z.object({ agentId: z.string().uuid(), jobId: z.string() }))
  .query(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find(agent => agent.id === input.agentId && agent.type === AiAgentType.CERTA);

    if (!agent) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const job = await storage.hgetall(`certa-job:${input.jobId}`);

    if (!job.status) {
      throw new Error('Job not found');
    }

    return {
      url: job.url as string,
      status: job.status as string,
      created: job.created as string,
      error: job.error ? (job.error as string) : null,
      results: job.results ? JSON.parse(job.results) : null,
      partialResults: job.partialResults
        ? JSON.parse(job.partialResults)
        : null,
    };
  });
