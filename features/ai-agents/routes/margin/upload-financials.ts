/**
 * Route: Upload Financials
 *
 * Handles FF Financials CSV upload for the MARGIN agent. Fetches the file
 * from S3 (uploaded via presigned URL), parses it, runs purely computational
 * margin analysis, persists the result, and returns the analysisId along
 * with the full result.
 *
 * Frontend hook: features/ai-agents/api/margin/upload-financials.ts
 */

import { z } from 'zod';

import { procedure } from '@/server/trpc';
import logger from '@/server/logger';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';
import { parseFinancials } from '@/features/ai-agents/utils/margin/parseFinancials';
import { runAnalysis } from '@/features/ai-agents/utils/margin/analyzeMargins';
import { createMarginAnalysis } from '@/features/ai-agents/dal/margin';

const input = z.object({
  aiAgentId: z.string().uuid(),
  fileKey: z.string().min(1),
  fileName: z.string().min(1),
  documentUploadProviderId: z.string().uuid(),
});

export default procedure.input(input).mutation(async ({ ctx, input }) => {
  const agents = await getAvailableAgents(ctx.userId);
  const agent = agents.find(
    (a) => a.id === input.aiAgentId && a.type === AiAgentType.MARGIN,
  );

  if (!agent) {
    throw new Error('MARGIN agent not found');
  }

  logger.info('Uploading FF Financials', {
    aiAgentId: input.aiAgentId,
    fileName: input.fileName,
    userId: ctx.userId,
  });

  const factory = new DocumentUploadFactory({ userId: ctx.userId });
  const { source: storageProvider } = await factory.buildSource(input.documentUploadProviderId);

  let buffer: Buffer;
  try {
    buffer = await storageProvider.fetchFile(input.fileKey);
  } catch (error) {
    logger.error('Error fetching file from storage:', error);
    throw new Error('Failed to retrieve uploaded file from storage.');
  }

  let rows;

  try {
    rows = await parseFinancials(buffer);
  } catch (error) {
    await storageProvider.deleteFile(input.fileKey).catch((err) => {
      logger.warn('Failed to clean up S3 file after parse error', { fileKey: input.fileKey, err });
    });
    logger.error('Error parsing FF Financials file:', error);
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to parse file. Please ensure it is a valid FF Financials CSV.',
    );
  }

  if (rows.length === 0) {
    await storageProvider.deleteFile(input.fileKey).catch((err) => {
      logger.warn('Failed to clean up S3 file after empty rows', { fileKey: input.fileKey, err });
    });
    throw new Error('No valid data rows found in file.');
  }

  const result = runAnalysis(rows);

  const { analysisId } = await createMarginAnalysis({
    agentId: input.aiAgentId,
    userId: ctx.userId,
    filename: input.fileName,
    result,
  });

  await storageProvider.deleteFile(input.fileKey).catch((err) => {
    logger.warn('Failed to clean up S3 file after successful analysis', { fileKey: input.fileKey, err });
  });

  logger.info('MARGIN analysis complete', {
    analysisId,
    totalJobsAnalyzed: result.totalJobsAnalyzed,
    totalFlaggedJobs: result.totalFlaggedJobs,
  });

  return { analysisId, result };
});
