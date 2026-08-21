import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';

const getPresignedUrlSchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
  documentUploadProviderId: z.string(),
});

export default procedure
  .input(getPresignedUrlSchema)
  .mutation(async ({ ctx, input }) => {
    const { fileName, contentType, documentUploadProviderId } = input;
    
    const factory = new DocumentUploadFactory({ userId: ctx.userId });
    const { source: storageProvider } = await factory.buildSource(documentUploadProviderId);
    
    const { presignedUrl, fileKey } = await storageProvider.generatePresignedUploadUrl(
      fileName,
      contentType,
      ctx.userId
    );

    ctx.logger.debug(`Generated presigned URL for file: ${fileName}`);

    return {
      presignedUrl,
      fileKey,
      fileName,
    };
  });
