import { z } from 'zod';

import { procedure } from '@/server/trpc';
import logger from '@/server/logger';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';
import db from '@/server/db';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const input = z.object({
  agentId: z.string().uuid(),
  requirementsFileName: z.string().min(1),
  proposalFileName: z.string().min(1),
  proposalContentType: z.string().min(1),
});

const output = z.object({
  requirementsFileKey: z.string(),
  requirementsPresignedUrl: z.string(),
  proposalFileKey: z.string(),
  proposalPresignedUrl: z.string(),
  documentUploadProviderId: z.string(),
});

export const getPrismUploadUrls = procedure
  .input(input)
  .output(output)
  .mutation(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find(
      (a) => a.id === input.agentId && a.type === AiAgentType.PRISM,
    );

    if (!agent) {
      throw new Error('PRISM agent not found or access denied');
    }

    const provider = await db.documentUploadProvider.findFirst({
      where: { deletedAt: null },
    });

    if (!provider) {
      throw new Error('No document upload provider configured. Please configure one in Settings.');
    }

    const factory = new DocumentUploadFactory({ userId: ctx.userId });
    const { source: storageProvider } = await factory.buildSource(provider.id);

    const [requirements, proposal] = await Promise.all([
      storageProvider.generatePresignedUploadUrl(
        input.requirementsFileName,
        XLSX_CONTENT_TYPE,
        ctx.userId,
      ),
      storageProvider.generatePresignedUploadUrl(
        input.proposalFileName,
        input.proposalContentType,
        ctx.userId,
      ),
    ]);

    logger.info('Generated PRISM presigned upload URLs', {
      agentId: input.agentId,
      requirementsFileName: input.requirementsFileName,
      proposalFileName: input.proposalFileName,
    });

    return {
      requirementsFileKey: requirements.fileKey,
      requirementsPresignedUrl: requirements.presignedUrl,
      proposalFileKey: proposal.fileKey,
      proposalPresignedUrl: proposal.presignedUrl,
      documentUploadProviderId: provider.id,
    };
  });
