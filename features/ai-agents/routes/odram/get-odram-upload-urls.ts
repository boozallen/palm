import { z } from 'zod';

import { procedure } from '@/server/trpc';
import logger from '@/server/logger';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';
import db from '@/server/db';

const fileInfoSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

const input = z.object({
  agentId: z.string().uuid(),
  promptMatrixFile: fileInfoSchema,
  odramFile: fileInfoSchema,
  proposalFiles: z.array(fileInfoSchema).min(1),
});

const uploadInfoSchema = z.object({
  fileKey: z.string(),
  presignedUrl: z.string(),
  fileName: z.string(),
  contentType: z.string(),
});

const output = z.object({
  promptMatrixUpload: uploadInfoSchema,
  odramUpload: uploadInfoSchema,
  proposalUploads: z.array(uploadInfoSchema),
  documentUploadProviderId: z.string(),
});

export const getOdramUploadUrls = procedure
  .input(input)
  .output(output)
  .mutation(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find(
      (a) => a.id === input.agentId && a.type === AiAgentType.ODRAM,
    );

    if (!agent) {
      throw new Error('ODRAM agent not found or access denied');
    }

    const provider = await db.documentUploadProvider.findFirst({
      where: { deletedAt: null },
    });

    if (!provider) {
      throw new Error('No document upload provider configured. Please configure one in Settings.');
    }

    const factory = new DocumentUploadFactory({ userId: ctx.userId });
    const { source: storageProvider } = await factory.buildSource(provider.id);

    // Generate presigned URL for the Prompt Matrix file
    const promptMatrixUploadResult = await storageProvider.generatePresignedUploadUrl(
      input.promptMatrixFile.fileName,
      input.promptMatrixFile.contentType,
      ctx.userId,
    );

    // Generate presigned URL for the ODRAM responses file
    const odramUploadResult = await storageProvider.generatePresignedUploadUrl(
      input.odramFile.fileName,
      input.odramFile.contentType,
      ctx.userId,
    );

    // Generate presigned URLs for all proposal documents
    const proposalUploads = await Promise.all(
      input.proposalFiles.map(async (file) => {
        const result = await storageProvider.generatePresignedUploadUrl(
          file.fileName,
          file.contentType,
          ctx.userId,
        );
        return {
          fileKey: result.fileKey,
          presignedUrl: result.presignedUrl,
          fileName: file.fileName,
          contentType: file.contentType,
        };
      }),
    );

    logger.info('Generated ODRAM presigned upload URLs', {
      agentId: input.agentId,
      promptMatrixFileName: input.promptMatrixFile.fileName,
      odramFileName: input.odramFile.fileName,
      proposalFileCount: input.proposalFiles.length,
    });

    return {
      promptMatrixUpload: {
        fileKey: promptMatrixUploadResult.fileKey,
        presignedUrl: promptMatrixUploadResult.presignedUrl,
        fileName: input.promptMatrixFile.fileName,
        contentType: input.promptMatrixFile.contentType,
      },
      odramUpload: {
        fileKey: odramUploadResult.fileKey,
        presignedUrl: odramUploadResult.presignedUrl,
        fileName: input.odramFile.fileName,
        contentType: input.odramFile.contentType,
      },
      proposalUploads,
      documentUploadProviderId: provider.id,
    };
  });
