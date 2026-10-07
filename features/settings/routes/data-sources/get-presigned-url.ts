import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { BadRequest, Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import db from '@/server/db';

const inputSchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
});

export default procedure
  .input(inputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      const leadMembership = await db.userGroupMembership.findFirst({
        where: { userId: ctx.userId, role: UserGroupRole.Lead },
      });
      if (!leadMembership) {
        throw Forbidden('You do not have permission to upload admin data sources');
      }
    }

    const systemConfig = await getSystemConfig();
    const documentUploadProviderId = systemConfig.documentLibraryDocumentUploadProviderId;

    if (!documentUploadProviderId) {
      throw BadRequest('No document upload provider is configured');
    }

    const { fileName, contentType } = input;
    const factory = new DocumentUploadFactory({ userId: ctx.userId });
    const { source: storageProvider } = await factory.buildSource(documentUploadProviderId);

    const { presignedUrl, fileKey } = await storageProvider.generatePresignedUploadUrl(
      fileName,
      contentType,
      ctx.userId,
    );

    return { presignedUrl, fileKey, fileName };
  });
