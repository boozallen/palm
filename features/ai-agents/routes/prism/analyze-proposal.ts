import { z } from 'zod';
import { v4 as uuid } from 'uuid';

import { procedure } from '@/server/trpc';
import logger from '@/server/logger';
import { storage } from '@/server/storage/redis';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { getPrismQueue } from '@/features/ai-agents/utils/prism/worker/queue';
import createPrismJob from '@/features/ai-agents/dal/prism/createPrismJob';
import {
  AuditRecordEvent,
  AuditRecordOutcome,
  AuditRecordResourceType,
} from '@/features/shared/types/audit-record';
import resolveUserGroupId from '@/features/shared/services/resolveUserGroupId';

const input = z.object({
  agentId: z.string().uuid(),
  requirementsFileKey: z.string().min(1),
  requirementsFileName: z.string().min(1),
  proposalFileKey: z.string().min(1),
  proposalFileName: z.string().min(1),
  proposalContentType: z.string().min(1),
  documentUploadProviderId: z.string().uuid(),
  modelId: z.string().min(1),
  userGroupId: z.string().uuid().nullish(),
});

const output = z.object({
  jobId: z.string(),
  message: z.string(),
});

export default procedure
  .input(input)
  .output(output)
  .mutation(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find(
      (a) => a.id === input.agentId && a.type === AiAgentType.PRISM,
    );

    if (!agent) {
      ctx.auditor.createAuditRecord({
        event: AuditRecordEvent.AiAgentPrismFormSubmission,
        outcome: AuditRecordOutcome.Warn,
        description: `User attempted to submit a PRISM proposal analysis job but lacked access to agent "${input.agentId}"`,
        metadata: {
          resourceType: AuditRecordResourceType.AiAgentJob,
          aiAgentId: input.agentId,
        },
      });
      throw new Error('PRISM agent not found or access denied');
    }

    let userGroupId: string | null;
    try {
      userGroupId = await resolveUserGroupId(ctx.userId, input.userGroupId);
    } catch (error) {
      ctx.auditor.createAuditRecord({
        event: AuditRecordEvent.AiAgentPrismFormSubmission,
        outcome: AuditRecordOutcome.Warn,
        description: 'User attempted to submit a PRISM proposal analysis job but lacked permission for the selected group',
        metadata: {
          resourceType: AuditRecordResourceType.AiAgentJob,
          aiAgentId: input.agentId,
        },
      });
      throw error;
    }

    const jobId = uuid();
    const queue = getPrismQueue();

    if (!queue) {
      ctx.auditor.createAuditRecord({
        event: AuditRecordEvent.AiAgentPrismFormSubmission,
        outcome: AuditRecordOutcome.Error,
        description: 'User failed to submit a PRISM proposal analysis job: job queue unavailable',
        metadata: {
          resourceType: AuditRecordResourceType.AiAgentJob,
          aiAgentId: input.agentId,
        },
      });
      throw new Error('PRISM job queue not available');
    }

    await createPrismJob({
      id: jobId,
      aiAgentId: input.agentId,
      userId: ctx.userId,
      requirementsFilename: input.requirementsFileName,
      proposalFilename: input.proposalFileName,
      userGroupId,
    });

    await storage.hset(`prism-job:${jobId}`, {
      status: 'queued',
      progress: 'Job queued, waiting to start...',
      created: Date.now(),
      last_updated: Date.now(),
    });

    await queue.add('prismJob', {
      jobId,
      userId: ctx.userId,
      agentId: input.agentId,
      requirementsFileKey: input.requirementsFileKey,
      requirementsFilename: input.requirementsFileName,
      proposalFileKey: input.proposalFileKey,
      proposalFilename: input.proposalFileName,
      proposalContentType: input.proposalContentType,
      documentUploadProviderId: input.documentUploadProviderId,
      modelId: input.modelId,
      userGroupId,
    });

    logger.info('PRISM job queued successfully', { jobId });

    ctx.auditor.createAuditRecord({
      event: AuditRecordEvent.AiAgentPrismFormSubmission,
      outcome: AuditRecordOutcome.Success,
      description: `User submitted a PRISM proposal analysis job for agent "${input.agentId}"`,
      metadata: {
        resourceType: AuditRecordResourceType.AiAgentJob,
        resourceIds: [jobId],
        aiAgentId: input.agentId,
        aiAgentJobId: jobId,
      },
    });

    return {
      jobId,
      message: 'Proposal analysis job queued successfully',
    };
  });
