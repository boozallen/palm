import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { BadRequest, Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';

const inputSchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
});

export default procedure
  .input(inputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to upload templates');
    }

    const systemConfig = await getSystemConfig();
    const documentUploadProviderId = systemConfig.documentLibraryDocumentUploadProviderId;

    if (!documentUploadProviderId) {
      throw BadRequest('No document upload provider is configured');
    }

    const factory = new DocumentUploadFactory({ userId: ctx.userId });
    const { source: storageProvider } = await factory.buildSource(documentUploadProviderId);

    const { presignedUrl, fileKey } = await storageProvider.generatePresignedUploadUrl(
      input.fileName,
      input.contentType,
      ctx.userId,
    );

    ctx.logger.info(`[TEMPLATES] Generated presigned URL for file: ${input.fileName} fileKey: ${fileKey}`);

    return { presignedUrl, fileKey };
  });
