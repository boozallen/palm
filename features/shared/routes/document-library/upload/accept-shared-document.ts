import { z } from 'zod';
import { procedure } from '@/server/trpc';
import acceptSharedDocument from '@/features/shared/dal/document-library/upload/acceptSharedDocument';
import getUserGroups from '@/features/profile/dal/getUserGroups';
import { SharedDocumentActionSchema } from '@/features/shared/types/document';
import { BadRequest } from '@/features/shared/errors/routeErrors';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  sharedDocumentId: z.string().uuid(),
});

const outputSchema = z.object({
  action: SharedDocumentActionSchema,
  filename: z.string(),
  graphCopyJobId: z.string().uuid().nullable(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { userId } = ctx;

    // Get user's group memberships
    const userGroups = await getUserGroups(userId);
    const userGroupIds = userGroups.map((g) => g.id);

    if (userGroupIds.length === 0) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${userId} attempted to accept shared document ${input.sharedDocumentId} but is not a member of any user groups`,
        event: AuditRecordEvent.AcceptDocumentLibraryDataShare,
      });
      throw BadRequest('You must be a member of a user group to accept shared documents');
    }

    try {
      const result = await acceptSharedDocument({
        sharedDocumentId: input.sharedDocumentId,
        userId,
        userGroupIds,
      });

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `User ${userId} accepted shared document ${input.sharedDocumentId}, created copy ${result.action.copiedDocumentId}`,
        event: AuditRecordEvent.AcceptDocumentLibraryDataShare,
      });

      return result;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `User ${userId} failed to accept shared document ${input.sharedDocumentId}: ${(error as Error).message}`,
        event: AuditRecordEvent.AcceptDocumentLibraryDataShare,
      });
      throw error;
    }
  });
