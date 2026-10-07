import { z } from 'zod';

import { procedure } from '@/server/trpc';
import logger from '@/server/logger';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';
import db from '@/server/db';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const input = z.object({
  agentId: z.string().uuid(),
  surveyFileName: z.string().min(1),
});

const output = z.object({
  surveyFileKey: z.string(),
  surveyPresignedUrl: z.string(),
  documentUploadProviderId: z.string(),
});

export const getPulseUploadUrl = procedure
  .input(input)
  .output(output)
  .mutation(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find((a) => a.id === input.agentId && a.type === AiAgentType.PULSE);

    if (!agent) {
      throw Forbidden('PULSE agent not found or access denied');
    }

    const provider = await db.documentUploadProvider.findFirst({ where: { deletedAt: null } });

    if (!provider) {
      throw new Error('No document upload provider configured. Please configure one in Settings.');
    }

    const factory = new DocumentUploadFactory({ userId: ctx.userId });
    const { source: storageProvider } = await factory.buildSource(provider.id);

    const survey = await storageProvider.generatePresignedUploadUrl(
      input.surveyFileName,
      XLSX_CONTENT_TYPE,
      ctx.userId,
    );

    logger.info('Generated PULSE presigned upload URL', {
      agentId: input.agentId,
      surveyFileName: input.surveyFileName,
    });

    return {
      surveyFileKey: survey.fileKey,
      surveyPresignedUrl: survey.presignedUrl,
      documentUploadProviderId: provider.id,
    };
  });
