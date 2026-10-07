import { z } from 'zod';
import { v4 as uuid } from 'uuid';

import { procedure } from '@/server/trpc';
import logger from '@/server/logger';
import { storage } from '@/server/storage/redis';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { getOdramQueue } from '@/features/ai-agents/utils/odram/worker/queue';
import createOdramJob from '@/features/ai-agents/dal/odram/createOdramJob';
import {
  AuditRecordEvent,
  AuditRecordOutcome,
  AuditRecordResourceType,
} from '@/features/shared/types/audit-record';
import resolveUserGroupId from '@/features/shared/services/resolveUserGroupId';

const proposalFileSchema = z.object({
  fileKey: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

const input = z.object({
  agentId: z.string().uuid(),
  promptMatrixFileKey: z.string().min(1),
  promptMatrixFileName: z.string().min(1),
  promptMatrixContentType: z.string().min(1),
  odramFileKey: z.string().min(1),
  odramFileName: z.string().min(1),
  odramContentType: z.string().min(1),
  proposalFiles: z.array(proposalFileSchema).min(1),
  documentUploadProviderId: z.string().uuid(),
  modelId: z.string().min(1),
  documentMapping: z.record(z.coerce.number(), z.array(z.string())).nullable().default(null),
  questionContext: z.record(z.coerce.number(), z.string()).nullable().default(null),
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
      (agent) => agent.id === input.agentId && agent.type === AiAgentType.ODRAM,
    );

    if (!agent) {
      ctx.auditor.createAuditRecord({
        event: AuditRecordEvent.AiAgentOdramFormSubmission,
        outcome: AuditRecordOutcome.Warn,
        description: `User attempted to submit an ODRAM analysis job but lacked access to agent "${input.agentId}"`,
        metadata: {
          resourceType: AuditRecordResourceType.AiAgentJob,
          aiAgentId: input.agentId,
        },
      });
      throw new Error('ODRAM agent not found or access denied');
    }

    let userGroupId: string | null;
    try {
      userGroupId = await resolveUserGroupId(ctx.userId, input.userGroupId);
    } catch (error) {
      ctx.auditor.createAuditRecord({
        event: AuditRecordEvent.AiAgentOdramFormSubmission,
        outcome: AuditRecordOutcome.Warn,
        description: 'User attempted to submit an ODRAM analysis job but lacked permission for the selected group',
        metadata: {
          resourceType: AuditRecordResourceType.AiAgentJob,
          aiAgentId: input.agentId,
        },
      });
      throw error;
    }

    logger.info('Processing ODRAM analysis request', {
      agentId: input.agentId,
      odramFile: input.odramFileName,
      proposalFileCount: input.proposalFiles.length,
      modelId: input.modelId,
      userId: ctx.userId,
    });

    const jobId = uuid();
    const queue = getOdramQueue();

    if (!queue) {
      ctx.auditor.createAuditRecord({
        event: AuditRecordEvent.AiAgentOdramFormSubmission,
        outcome: AuditRecordOutcome.Error,
        description: 'User failed to submit an ODRAM analysis job: job queue unavailable',
        metadata: {
          resourceType: AuditRecordResourceType.AiAgentJob,
          aiAgentId: input.agentId,
        },
      });
      throw new Error('ODRAM job queue not available');
    }

    await createOdramJob({
      id: jobId,
      aiAgentId: input.agentId,
      userId: ctx.userId,
      odramFilename: input.odramFileName,
      userGroupId,
    });

    await storage.hset(`odram-job:${jobId}`, {
      status: 'queued',
      progress: 'Job queued, waiting to start...',
      created: Date.now(),
      last_updated: Date.now(),
    });

    await queue.add('odramJob', {
      jobId,
      userId: ctx.userId,
      agentId: input.agentId,
      promptMatrixFileKey: input.promptMatrixFileKey,
      promptMatrixFileName: input.promptMatrixFileName,
      promptMatrixContentType: input.promptMatrixContentType,
      odramFileKey: input.odramFileKey,
      odramFileName: input.odramFileName,
      odramContentType: input.odramContentType,
      proposalFiles: input.proposalFiles,
      documentUploadProviderId: input.documentUploadProviderId,
      modelId: input.modelId,
      documentMapping: input.documentMapping,
      questionContext: input.questionContext,
      userGroupId,
    });

    logger.info('ODRAM job queued successfully', {
      jobId,
      proposalFileCount: input.proposalFiles.length,
    });

    ctx.auditor.createAuditRecord({
      event: AuditRecordEvent.AiAgentOdramFormSubmission,
      outcome: AuditRecordOutcome.Success,
      description: `User submitted an ODRAM analysis job for agent "${input.agentId}"`,
      metadata: {
        resourceType: AuditRecordResourceType.AiAgentJob,
        resourceIds: [jobId],
        aiAgentId: input.agentId,
        aiAgentJobId: jobId,
      },
    });

    return {
      jobId,
      message: 'ODRAM analysis job queued successfully',
    };
  });
