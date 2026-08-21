import { z } from 'zod';
import { v4 as uuid } from 'uuid';

import { procedure } from '@/server/trpc';
import logger from '@/server/logger';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import createRateCard from '@/features/ai-agents/dal/rcast/createRateCard';
import { parseRateCard } from '@/features/ai-agents/utils/rcast/parseRateCard';
import { getRcastQueue } from '@/features/ai-agents/utils/rcast/worker/queue';

const input = z.object({
  aiAgentId: z.string().uuid(),
  fileContent: z.string(),
  fileName: z.string().min(1),
  modelId: z.string().min(1),
});

const output = z.object({
  rateCardId: z.string().uuid(),
  jobId: z.string().optional(),
  message: z.string(),
});

export default procedure
  .input(input)
  .output(output)
  .mutation(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find(
      (agent) => agent.id === input.aiAgentId && agent.type === AiAgentType.RCAST
    );

    if (!agent) {
      throw new Error('RCAST-TWO agent not found');
    }

    logger.info('Uploading rate card', {
      aiAgentId: input.aiAgentId,
      fileName: input.fileName,
      userId: ctx.userId,
    });

    const buffer = Buffer.from(input.fileContent, 'base64');
    let parsedRows;

    try {
      parsedRows = await parseRateCard(buffer, input.fileName);
    } catch (error) {
      logger.error('Error parsing rate card file:', error);
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Failed to parse file. Please ensure it matches the expected rate card format.'
      );
    }

    if (!parsedRows || parsedRows.length === 0) {
      throw new Error('No valid data found in file.');
    }

    logger.info('Parsed rate card data', {
      rowCount: parsedRows.length,
      fileName: input.fileName,
    });

    const result = await createRateCard({
      aiAgentId: input.aiAgentId,
      userId: ctx.userId,
      fileName: input.fileName,
      parsedRows,
    });

    let jobId: string | undefined;
    const queue = getRcastQueue();
    if (queue) {
      jobId = uuid();
      try {
        await queue.add('rcastJob', {
          jobId,
          userId: ctx.userId,
          agentId: input.aiAgentId,
          rateCardId: result.rateCardId,
          modelId: input.modelId,
        });
        logger.info('RCAST-TWO worker job queued', {
          jobId,
          rateCardId: result.rateCardId,
        });
      } catch (error) {
        logger.error('Failed to queue RCAST-TWO worker job:', error);
        jobId = undefined;
      }
    } else {
      logger.warn('RCAST-TWO queue not available, skipping background processing');
    }

    return {
      rateCardId: result.rateCardId,
      jobId,
      message: `Rate card "${input.fileName}" uploaded successfully. Processed ${result.successCount} labor categories${result.failureCount > 0 ? ` (${result.failureCount} failed)` : ''}. Background processing has been queued.`,
    };
  });
