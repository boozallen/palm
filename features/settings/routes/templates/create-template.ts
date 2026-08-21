import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { BadRequest, Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import createTemplate from '@/features/settings/dal/templates/createTemplate';
import { createAuditor } from '@/server/auditor';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  fileName: z.string().min(1),
  fileKey: z.string().min(1),
});

const outputSchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
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

    ctx.logger.info(`[TEMPLATES] Fetching file from S3 fileKey: ${input.fileKey}`);
    const fileBuffer = await storageProvider.fetchFile(input.fileKey);
    const fileData = fileBuffer.toString('base64');

    ctx.logger.info(`[TEMPLATES] Saving template to database filename: ${input.fileName.toLowerCase()} size: ${fileBuffer.length} bytes`);
    const auditor = createAuditor({ userId: ctx.userId, referer: null });

    const template = await createTemplate({
      filename: input.fileName.toLowerCase(),
      fileData,
    });

    ctx.logger.info(`[TEMPLATES] Template saved id: ${template.id}`);

    auditor.createAuditRecord({
      outcome: AuditRecordOutcome.Success,
      description: `User ${ctx.userId} uploaded artifact template "${input.fileName.toLowerCase()}"`,
      event: AuditRecordEvent.UploadArtifactTemplate,
    });

    // Clean up S3 — template is now stored in the database
    await storageProvider.deleteFile(input.fileKey).catch(() => {
      ctx.logger.warn(`[TEMPLATES] Failed to delete S3 object after template upload: ${input.fileKey}`);
    });
    ctx.logger.info(`[TEMPLATES] S3 cleanup complete fileKey: ${input.fileKey}`);

    return template;
  });
