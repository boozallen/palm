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
import {
  AuditRecordEvent,
  AuditRecordOutcome,
  AuditRecordResourceType,
} from '@/features/shared/types/audit-record';
import resolveUserGroupId from '@/features/shared/services/resolveUserGroupId';

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
      userGroupId: z.string().uuid().nullish(),
    })
  )
  .mutation(async ({ ctx, input }) => {

    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find(agent => agent.id === input.agentId && agent.type === AiAgentType.CERTA);

    if (!agent) {
      ctx.auditor.createAuditRecord({
        event: AuditRecordEvent.AiAgentCertaFormSubmission,
        outcome: AuditRecordOutcome.Warn,
        description: `User attempted to submit a CERTA policy compliance job but lacked access to agent "${input.agentId}"`,
        metadata: {
          resourceType: AuditRecordResourceType.AiAgentJob,
          aiAgentId: input.agentId,
        },
      });
      throw Forbidden('You do not have permission to access this resource');
    }

    let userGroupId: string | null;
    try {
      userGroupId = await resolveUserGroupId(ctx.userId, input.userGroupId);
    } catch (error) {
      ctx.auditor.createAuditRecord({
        event: AuditRecordEvent.AiAgentCertaFormSubmission,
        outcome: AuditRecordOutcome.Warn,
        description: 'User attempted to submit a CERTA policy compliance job but lacked permission for the selected group',
        metadata: {
          resourceType: AuditRecordResourceType.AiAgentJob,
          aiAgentId: input.agentId,
        },
      });
      throw error;
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
      ctx.auditor.createAuditRecord({
        event: AuditRecordEvent.AiAgentCertaFormSubmission,
        outcome: AuditRecordOutcome.Error,
        description: 'User failed to submit a CERTA policy compliance job: job queue unavailable',
        metadata: {
          resourceType: AuditRecordResourceType.AiAgentJob,
          aiAgentId: input.agentId,
        },
      });
      throw new Error('CERTA agent is not available at this time.');
    }
    // The worker reads AIFactory attribution from BullMQ job.data, not the Redis status hash,
    // so userGroupId only needs to be carried here.
    await queue.add('complianceJob', {
      ...input,
      jobId,
      userId: ctx.userId,
      userGroupId,
    });

    ctx.auditor.createAuditRecord({
      event: AuditRecordEvent.AiAgentCertaFormSubmission,
      outcome: AuditRecordOutcome.Success,
      description: `User submitted a CERTA policy compliance job for agent "${input.agentId}"`,
      metadata: {
        resourceType: AuditRecordResourceType.AiAgentJob,
        resourceIds: [jobId],
        aiAgentId: input.agentId,
        aiAgentJobId: jobId,
      },
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
