import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { NotFound, Forbidden, BadRequest } from '@/features/shared/errors/routeErrors';
import getDocument from '@/features/shared/dal/document-library/upload/getDocument';
import getUserGroups from '@/features/profile/dal/getUserGroups';
import createSharedDocument from '@/features/shared/dal/document-library/upload/createSharedDocument';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import { SharedDocumentSchema } from '@/features/shared/types/document';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  documentId: z.string().uuid(),
  userGroupIds: z.array(z.string().uuid()).optional(),
});

const outputSchema = z.object({
  sharedDocument: SharedDocumentSchema,
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const systemConfig = await getSystemConfig();
    if (!systemConfig?.documentLibraryDataSharingEnabled) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to share document ${input.documentId} but data sharing is disabled`,
        event: AuditRecordEvent.ShareDocumentLibraryData,
      });
      throw Forbidden('Document sharing is not enabled');
    }

    const document = await getDocument(input.documentId);

    if (!document) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to share non-existent document ${input.documentId}`,
        event: AuditRecordEvent.ShareDocumentLibraryData,
      });
      throw NotFound('Document not found');
    }

    if (document.adminCreated) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to share admin data source ${input.documentId}`,
        event: AuditRecordEvent.ShareDocumentLibraryData,
      });
      throw Forbidden('Admin data sources cannot be reshared');
    }

    if (document.userId !== ctx.userId) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to share document ${input.documentId} owned by ${document.userId}`,
        event: AuditRecordEvent.ShareDocumentLibraryData,
      });
      throw Forbidden('You do not have permission to share this document');
    }

    const userGroups = await getUserGroups(ctx.userId);

    if (userGroups.length === 0) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to share document ${input.documentId} but is not a member of any user groups`,
        event: AuditRecordEvent.ShareDocumentLibraryData,
      });
      throw BadRequest('You must be a member of at least one user group to share a document');
    }

    if (!input.userGroupIds || input.userGroupIds.length === 0) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to share document ${input.documentId} without selecting any user groups`,
        event: AuditRecordEvent.ShareDocumentLibraryData,
      });
      throw BadRequest('You must select at least one user group to share with');
    }

    // Validate that user is a member of all selected groups
    const userGroupIds = userGroups.map((g) => g.id);
    const invalidGroupIds = input.userGroupIds.filter((id) => !userGroupIds.includes(id));

    if (invalidGroupIds.length > 0) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to share document ${input.documentId} with groups they are not a member of: ${invalidGroupIds.join(', ')}`,
        event: AuditRecordEvent.ShareDocumentLibraryData,
      });
      throw BadRequest('You can only share with user groups you are a member of');
    }

    const sharedWithUserGroupIds = input.userGroupIds;

    try {
      const sharedDocument = await createSharedDocument({
        sourceDocumentId: input.documentId,
        sourceUserId: ctx.userId,
        sharedWithUserGroupIds,
      });

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `User ${ctx.userId} shared document ${input.documentId} with user groups: ${sharedWithUserGroupIds.join(', ')}`,
        event: AuditRecordEvent.ShareDocumentLibraryData,
      });

      return {
        sharedDocument,
      };
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `User ${ctx.userId} failed to share document ${input.documentId}: ${(error as Error).message}`,
        event: AuditRecordEvent.ShareDocumentLibraryData,
      });
      throw error;
    }
  });
