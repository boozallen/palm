import { z } from 'zod';
import crypto from 'crypto';

import { procedure } from '@/server/trpc';
import { BadRequest, Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { AdminDocumentSchema } from '@/features/shared/types/document';
import createAdminDocument from '@/features/shared/dal/document-library/upload/createAdminDocument';
import assignAdminDocumentGroups from '@/features/shared/dal/document-library/upload/assignAdminDocumentGroups';
import { getDocumentQueue } from '@/features/document-upload-provider/workers/documentQueue';
import { storage } from '@/server/storage/redis';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import db from '@/server/db';

const inputSchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
  fileSize: z.number(),
  fileKey: z.string(),
  userGroupIds: z.array(z.string().uuid()).min(1),
});

const outputSchema = z.object({
  document: AdminDocumentSchema,
  jobId: z.string().nullable(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      const leadMembership = await db.userGroupMembership.findFirst({
        where: { userId: ctx.userId, role: UserGroupRole.Lead },
      });
      if (!leadMembership) {
        throw Forbidden('You do not have permission to create admin data sources');
      }
    }

    const systemConfig = await getSystemConfig();
    const documentUploadProviderId = systemConfig.documentLibraryDocumentUploadProviderId;

    if (!documentUploadProviderId) {
      throw BadRequest('No document upload provider is configured');
    }

    const { fileName, contentType, fileSize, fileKey, userGroupIds } = input;

    const document = await createAdminDocument({
      userId: ctx.userId,
      filename: fileName,
      documentUploadProviderId,
    });

    await db.$transaction(async (tx) => {
      await assignAdminDocumentGroups({ documentId: document.id, userGroupIds, tx });
    });

    const user = await db.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, email: true },
    });

    const userGroups = await db.userGroup.findMany({
      where: { id: { in: userGroupIds } },
      select: { id: true, label: true },
    });

    const jobId = crypto.randomUUID();
    const queue = getDocumentQueue();

    if (queue) {
      await storage.hset(`document-job:${jobId}`, {
        status: 'queued',
        created: Date.now(),
        progress: 'File uploaded, queued for processing...',
        documentId: document.id,
        documentUploadProviderId,
        fileKey,
        fileName,
        contentType,
        fileSize: fileSize.toString(),
        userId: ctx.userId,
      });

      await queue.add('documentProcessingJob', {
        documentId: document.id,
        documentUploadProviderId,
        jobId,
        userId: ctx.userId,
        fileKey,
        fileName,
        contentType,
        fileSize,
      });
    }

    return {
      document: {
        ...document,
        assignedGroupIds: userGroupIds,
        userName: user?.name ?? '',
        userEmail: user?.email ?? undefined,
        userGroupMemberships: userGroups,
      },
      jobId: queue ? jobId : null,
    };
  });
