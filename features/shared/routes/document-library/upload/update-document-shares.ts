import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { NotFound, Forbidden, BadRequest } from '@/features/shared/errors/routeErrors';
import getDocument from '@/features/shared/dal/document-library/upload/getDocument';
import getUserGroups from '@/features/profile/dal/getUserGroups';
import createSharedDocument from '@/features/shared/dal/document-library/upload/createSharedDocument';
import softDeleteSharedDocument from '@/features/shared/dal/document-library/upload/softDeleteSharedDocument';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import { SharedDocumentSchema } from '@/features/shared/types/document';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import db from '@/server/db';

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
        description: `User ${ctx.userId} attempted to update shares for document ${input.documentId} but data sharing is disabled`,
        event: AuditRecordEvent.UpdateDocumentShares,
      });
      throw Forbidden('Document sharing is not enabled');
    }

    const document = await getDocument(input.documentId);

    if (!document) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to update shares for non-existent document ${input.documentId}`,
        event: AuditRecordEvent.UpdateDocumentShares,
      });
      throw NotFound('Document not found');
    }

    if (document.userId !== ctx.userId) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to update shares for document ${input.documentId} owned by ${document.userId}`,
        event: AuditRecordEvent.UpdateDocumentShares,
      });
      throw Forbidden('You do not have permission to update shares for this document');
    }

    const userGroups = await getUserGroups(ctx.userId);

    if (userGroups.length === 0) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to update shares for document ${input.documentId} but is not a member of any user groups`,
        event: AuditRecordEvent.UpdateDocumentShares,
      });
      throw BadRequest('You must be a member of at least one user group to update document shares');
    }

    if (input.userGroupIds === undefined) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to update shares for document ${input.documentId} without specifying user groups`,
        event: AuditRecordEvent.UpdateDocumentShares,
      });
      throw BadRequest('You must explicitly specify which user groups to share with (or provide an empty array to unshare)');
    }

    let sharedWithUserGroupIds = input.userGroupIds;

    if (sharedWithUserGroupIds.length > 0) {
      // Validate that user is a member of all selected groups
      const userGroupIds = userGroups.map((g) => g.id);
      const invalidGroupIds = sharedWithUserGroupIds.filter((id) => !userGroupIds.includes(id));

      if (invalidGroupIds.length > 0) {
        ctx.auditor.createAuditRecord({
          outcome: AuditRecordOutcome.Warn,
          description: `User ${ctx.userId} attempted to update shares for document ${input.documentId} with groups they are not a member of: ${invalidGroupIds.join(', ')}`,
          event: AuditRecordEvent.UpdateDocumentShares,
        });
        throw BadRequest('You can only share with user groups you are a member of');
      }
    }

    try {
      // Fetch existing SharedDocument with accepted actions before soft-deleting
      const existingSharedDocument = await db.sharedDocument.findFirst({
        where: {
          sourceDocumentId: input.documentId,
          sourceUserId: ctx.userId,
          deletedAt: null,
        },
        include: {
          actions: {
            where: {
              status: 'accepted',
            },
          },
        },
      });

      await softDeleteSharedDocument({
        sourceDocumentId: input.documentId,
        sourceUserId: ctx.userId,
      });

      const sharedDocument = await createSharedDocument({
        sourceDocumentId: input.documentId,
        sourceUserId: ctx.userId,
        sharedWithUserGroupIds,
      });

      // Preserve accepted actions so users who already accepted don't see it again
      if (existingSharedDocument && existingSharedDocument.actions.length > 0) {
        await db.sharedDocumentAction.createMany({
          data: existingSharedDocument.actions.map((action) => ({
            sharedDocumentId: sharedDocument.id,
            userId: action.userId,
            status: action.status,
            copiedDocumentId: action.copiedDocumentId,
          })),
          skipDuplicates: true,
        });
      }

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `User ${ctx.userId} updated shares for document ${input.documentId} with user groups: ${sharedWithUserGroupIds.join(', ')}`,
        event: AuditRecordEvent.UpdateDocumentShares,
      });

      return {
        sharedDocument,
      };
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `User ${ctx.userId} failed to update shares for document ${input.documentId}: ${(error as Error).message}`,
        event: AuditRecordEvent.UpdateDocumentShares,
      });
      throw error;
    }
  });
