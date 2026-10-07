import { z } from 'zod';
import { v4 as uuid } from 'uuid';

import { procedure } from '@/server/trpc';
import logger from '@/server/logger';
import { storage } from '@/server/storage/redis';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { getSwearQueue } from '@/features/ai-agents/utils/swear/worker/queue';
import { parseFile } from '@/features/document-upload-provider/sources/utils/file-helpers';
import {
  AuditRecordEvent,
  AuditRecordOutcome,
  AuditRecordResourceType,
} from '@/features/shared/types/audit-record';
import resolveUserGroupId from '@/features/shared/services/resolveUserGroupId';

const input = z.object({
  agentId: z.string().uuid(),
  fileContent: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
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
    // Verify user has access to SWEAR agent
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find(
      (agent) => agent.id === input.agentId && agent.type === AiAgentType.SWEAR
    );

    if (!agent) {
      ctx.auditor.createAuditRecord({
        event: AuditRecordEvent.AiAgentSwearFormSubmission,
        outcome: AuditRecordOutcome.Warn,
        description: `User attempted to submit a SWEAR warrant analysis job but lacked access to agent "${input.agentId}"`,
        metadata: {
          resourceType: AuditRecordResourceType.AiAgentJob,
          aiAgentId: input.agentId,
        },
      });
      throw new Error('SWEAR agent not found or access denied');
    }

    let userGroupId: string | null;
    try {
      userGroupId = await resolveUserGroupId(ctx.userId, input.userGroupId);
    } catch (error) {
      ctx.auditor.createAuditRecord({
        event: AuditRecordEvent.AiAgentSwearFormSubmission,
        outcome: AuditRecordOutcome.Warn,
        description: 'User attempted to submit a SWEAR warrant analysis job but lacked permission for the selected group',
        metadata: {
          resourceType: AuditRecordResourceType.AiAgentJob,
          aiAgentId: input.agentId,
        },
      });
      throw error;
    }

    logger.info('Processing warrant file for analysis', {
      agentId: input.agentId,
      fileName: input.fileName,
      contentType: input.contentType,
      modelId: input.modelId,
      userId: ctx.userId,
    });

    // Extract text from the uploaded file
    const buffer = Buffer.from(input.fileContent, 'base64');
    let documentText: string;
    try {
      documentText = await parseFile(buffer, input.contentType);
    } catch (error) {
      logger.error('Failed to parse warrant document', { error, fileName: input.fileName });
      ctx.auditor.createAuditRecord({
        event: AuditRecordEvent.AiAgentSwearFormSubmission,
        outcome: AuditRecordOutcome.Error,
        description: `User failed to submit a SWEAR warrant analysis job: failed to parse "${input.fileName}"`,
        metadata: {
          resourceType: AuditRecordResourceType.AiAgentJob,
          aiAgentId: input.agentId,
          filenames: [input.fileName],
        },
      });
      throw new Error('Failed to parse warrant document. Please ensure it is a valid PDF or DOCX file.');
    }

    if (!documentText || documentText.trim().length === 0) {
      ctx.auditor.createAuditRecord({
        event: AuditRecordEvent.AiAgentSwearFormSubmission,
        outcome: AuditRecordOutcome.Error,
        description: `User failed to submit a SWEAR warrant analysis job: no text extracted from "${input.fileName}"`,
        metadata: {
          resourceType: AuditRecordResourceType.AiAgentJob,
          aiAgentId: input.agentId,
          filenames: [input.fileName],
        },
      });
      throw new Error('No text could be extracted from the document. Please ensure it contains readable text.');
    }

    // Create job ID and queue the job
    const jobId = uuid();
    const queue = getSwearQueue();

    if (!queue) {
      ctx.auditor.createAuditRecord({
        event: AuditRecordEvent.AiAgentSwearFormSubmission,
        outcome: AuditRecordOutcome.Error,
        description: 'User failed to submit a SWEAR warrant analysis job: job queue unavailable',
        metadata: {
          resourceType: AuditRecordResourceType.AiAgentJob,
          aiAgentId: input.agentId,
        },
      });
      throw new Error('SWEAR job queue not available');
    }

    // Store initial job metadata in Redis
    await storage.hset(`swear-job:${jobId}`, {
      status: 'queued',
      progress: 'Job queued, waiting to start...',
      created: Date.now(),
      last_updated: Date.now(),
      filename: input.fileName,
    });

    // userGroupId is only needed by the worker (to build the AIFactory), which reads
    // from the BullMQ job payload, not the Redis status hash — no need to store it there too.
    await queue.add('swearJob', {
      jobId,
      userId: ctx.userId,
      agentId: input.agentId,
      documentText,
      modelId: input.modelId,
      filename: input.fileName,
      userGroupId,
    });

    logger.info('SWEAR job queued successfully', {
      jobId,
      fileName: input.fileName,
      textLength: documentText.length,
    });

    ctx.auditor.createAuditRecord({
      event: AuditRecordEvent.AiAgentSwearFormSubmission,
      outcome: AuditRecordOutcome.Success,
      description: `User submitted a SWEAR warrant analysis job for agent "${input.agentId}"`,
      metadata: {
        resourceType: AuditRecordResourceType.AiAgentJob,
        resourceIds: [jobId],
        aiAgentId: input.agentId,
        aiAgentJobId: jobId,
        filenames: [input.fileName],
      },
    });

    return {
      jobId,
      message: 'Warrant analysis job queued successfully',
    };
  });
