import { z } from 'zod';
import crypto from 'crypto';

import { procedure } from '@/server/trpc';
import { storage } from '@/server/storage/redis';
import { getResearchQueue } from '@/features/ai-agents/utils/radar/researchQueue';
import {
  generateSearchHash,
  generateCacheKey,
  generateActiveJobKey,
} from '@/features/ai-agents/utils/radar/searchHash';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import logger from '@/server/logger';

const researchInput = z.object({
  agentId: z.string().uuid(),
  dateStart: z.string(),
  dateEnd: z.string(),
  model: z.string().uuid(),
  categories: z.array(z.string()),
  institutions: z.array(z.string()),
});

export const startResearchJob = procedure
  .input(researchInput)
  .mutation(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find((agent) => agent.id === input.agentId && agent.type === AiAgentType.RADAR);

    if (!agent) {
      throw Forbidden(
        'You do not have permission to access this resource.'
      );
    }

    const searchHash = generateSearchHash({
      dateStart: input.dateStart,
      dateEnd: input.dateEnd,
      categories: input.categories,
      institutions: input.institutions,
    });

    const cacheKey = generateCacheKey(searchHash);
    const activeJobKey = generateActiveJobKey(searchHash);

    // Check if we have cached results for this search
    const cachedResults = await storage.get(cacheKey);

    if (cachedResults) {
      // Create a 'completed' job with cached results
      const jobId = crypto.randomUUID();

      await storage.hset(`research-job:${jobId}`, {
        status: 'completed',
        created: Date.now(),
        completed: Date.now(),
        progress: 'Found cached results!',
        results: cachedResults,
        searchHash,
        fromCache: 'true',
      });

      ctx.logger.debug(
        `Returning cached results for search hash: ${searchHash}`
      );
      return { jobId };
    }

    // Check if there's already an active job for this search
    const activeJobId = await storage.get(activeJobKey);

    if (activeJobId) {
      // Piggyback off the existing job
      const existingJob = await storage.hgetall(`research-job:${activeJobId}`);

      if (existingJob.status && existingJob.status !== 'error') {
        ctx.logger.debug(
          `Piggybacking off existing job ${activeJobId} for search hash: ${searchHash}`
        );
        return { jobId: activeJobId };
      } else {
        await storage.del(activeJobKey);
      }
    }

    // No cached results and no active job, start new job
    const jobId = crypto.randomUUID();

    // Mark this job as active for this search hash for one hour
    await storage.setex(activeJobKey, 3600, jobId);

    await storage.hset(`research-job:${jobId}`, {
      status: 'processing',
      created: Date.now(),
      progress: 'Initializing research...',
      searchHash,
    });

    const queue = getResearchQueue();
    if (!queue) {
      await storage.del(activeJobKey);
      logger.warn('Research queue is not initialized — job not queued.');
      throw new Error('Research agent is not available at this time.');
    }

    try {
      await queue.add('researchJob', {
        ...input,
        jobId,
        userId: ctx.userId,
        searchHash,
      });

      return { jobId };
    } catch (error) {
      await storage.del(activeJobKey);
      throw error;
    }
  });
