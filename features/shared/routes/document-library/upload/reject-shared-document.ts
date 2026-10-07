import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { BadRequest } from '@/features/shared/errors/routeErrors';
import getUserGroups from '@/features/profile/dal/getUserGroups';
import rejectSharedDocument from '@/features/shared/dal/document-library/upload/rejectSharedDocument';
import { SharedDocumentActionSchema } from '@/features/shared/types/document';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  sharedDocumentId: z.string().uuid(),
});

const outputSchema = z.object({
  action: SharedDocumentActionSchema,
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const userGroups = await getUserGroups(ctx.userId);

    if (userGroups.length === 0) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to reject shared document ${input.sharedDocumentId} but is not a member of any user groups`,
        event: AuditRecordEvent.RejectDocumentLibraryDataShare,
      });
      throw BadRequest('You must be a member of at least one user group');
    }

    const userGroupIds = userGroups.map((g) => g.id);

    try {
      const result = await rejectSharedDocument({
        sharedDocumentId: input.sharedDocumentId,
        userId: ctx.userId,
        userGroupIds,
      });

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `User ${ctx.userId} rejected shared document ${input.sharedDocumentId}`,
        event: AuditRecordEvent.RejectDocumentLibraryDataShare,
      });

      return result;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `User ${ctx.userId} failed to reject shared document ${input.sharedDocumentId}: ${(error as Error).message}`,
        event: AuditRecordEvent.RejectDocumentLibraryDataShare,
      });
      throw error;
    }
  });
