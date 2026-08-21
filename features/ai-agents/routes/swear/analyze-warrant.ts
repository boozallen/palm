import { z } from 'zod';
import { v4 as uuid } from 'uuid';

import { procedure } from '@/server/trpc';
import logger from '@/server/logger';
import { storage } from '@/server/storage/redis';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { getSwearQueue } from '@/features/ai-agents/utils/swear/worker/queue';
import { parseFile } from '@/features/document-upload-provider/sources/utils/file-helpers';

const input = z.object({
  agentId: z.string().uuid(),
  fileContent: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  modelId: z.string().min(1),
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
      throw new Error('SWEAR agent not found or access denied');
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
      throw new Error('Failed to parse warrant document. Please ensure it is a valid PDF or DOCX file.');
    }

    if (!documentText || documentText.trim().length === 0) {
      throw new Error('No text could be extracted from the document. Please ensure it contains readable text.');
    }

    // Create job ID and queue the job
    const jobId = uuid();
    const queue = getSwearQueue();

    if (!queue) {
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

    // Add job to queue
    await queue.add('swearJob', {
      jobId,
      userId: ctx.userId,
      agentId: input.agentId,
      documentText,
      modelId: input.modelId,
      filename: input.fileName,
    });

    logger.info('SWEAR job queued successfully', {
      jobId,
      fileName: input.fileName,
      textLength: documentText.length,
    });

    return {
      jobId,
      message: 'Warrant analysis job queued successfully',
    };
  });
