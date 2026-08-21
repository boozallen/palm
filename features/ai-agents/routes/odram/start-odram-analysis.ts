import { z } from 'zod';
import { v4 as uuid } from 'uuid';

import { procedure } from '@/server/trpc';
import logger from '@/server/logger';
import { storage } from '@/server/storage/redis';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { getOdramQueue } from '@/features/ai-agents/utils/odram/worker/queue';
import createOdramJob from '@/features/ai-agents/dal/odram/createOdramJob';

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
      throw new Error('ODRAM agent not found or access denied');
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
      throw new Error('ODRAM job queue not available');
    }

    await createOdramJob({
      id: jobId,
      aiAgentId: input.agentId,
      userId: ctx.userId,
      odramFilename: input.odramFileName,
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
    });

    logger.info('ODRAM job queued successfully', {
      jobId,
      proposalFileCount: input.proposalFiles.length,
    });

    return {
      jobId,
      message: 'ODRAM analysis job queued successfully',
    };
  });
