/**
 * Route: Get Margin Upload URL
 *
 * Generates a presigned S3 upload URL for the margin CSV file.
 * The frontend uploads directly to S3, then passes the fileKey
 * to the upload-financials route for processing.
 *
 * Frontend hook: features/ai-agents/api/margin/get-margin-upload-url.ts
 */

import { z } from 'zod';

import { procedure } from '@/server/trpc';
import logger from '@/server/logger';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';
import db from '@/server/db';

const input = z.object({
  aiAgentId: z.string().uuid(),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

const output = z.object({
  fileKey: z.string(),
  presignedUrl: z.string(),
  documentUploadProviderId: z.string(),
});

export const getMarginUploadUrl = procedure
  .input(input)
  .output(output)
  .mutation(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find(
      (a) => a.id === input.aiAgentId && a.type === AiAgentType.MARGIN,
    );

    if (!agent) {
      throw new Error('MARGIN agent not found or access denied');
    }

    const provider = await db.documentUploadProvider.findFirst({
      where: { deletedAt: null },
    });

    if (!provider) {
      throw new Error('No document upload provider configured. Please configure one in Settings.');
    }

    const factory = new DocumentUploadFactory({ userId: ctx.userId });
    const { source: storageProvider } = await factory.buildSource(provider.id);

    const { fileKey, presignedUrl } = await storageProvider.generatePresignedUploadUrl(
      input.fileName,
      input.contentType,
      ctx.userId,
    );

    logger.info('Generated margin presigned upload URL', {
      aiAgentId: input.aiAgentId,
      fileName: input.fileName,
    });

    return {
      fileKey,
      presignedUrl,
      documentUploadProviderId: provider.id,
    };
  });
