import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import demoteAdminDocument from '@/features/shared/dal/document-library/upload/demoteAdminDocument';
import getUser from '@/features/settings/dal/shared/getUser';
import db from '@/server/db';

const inputSchema = z.object({
  documentId: z.string().uuid(),
});

const outputSchema = z.object({
  id: z.string(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { documentId } = input;

    const currentUser = await getUser(ctx.userId);
    const document = await db.document.findUnique({
      where: { id: documentId },
      select: { id: true, adminCreated: true, userId: true, filename: true },
    });

    if (!document || !document.adminCreated) {
      throw NotFound('Admin data source not found');
    }

    if (ctx.userRole !== UserRole.Admin) {
      if (document.userId !== ctx.userId) {
        throw Forbidden('You do not have permission to delete this data source');
      }
      const leadMembership = await db.userGroupMembership.findFirst({
        where: { userId: ctx.userId, role: UserGroupRole.Lead },
      });
      if (!leadMembership) {
        throw Forbidden('You do not have permission to delete this data source');
      }
    }

    try {
      await db.$transaction((tx) => demoteAdminDocument(documentId, tx));

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `User ${currentUser?.name} demoted document "${document.filename}" from admin data source`,
        event: AuditRecordEvent.DemoteDocumentFromAdminDataSource,
      });

      return { id: documentId };
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `User ${currentUser?.name} failed to demote document "${document.filename}" from admin data source - ${(error as Error).message}`,
        event: AuditRecordEvent.DemoteDocumentFromAdminDataSource,
      });
      throw error;
    }
  });
