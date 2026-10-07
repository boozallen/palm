import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import demoteCollection from '@/features/shared/dal/document-library/upload/demoteCollection';
import getUser from '@/features/settings/dal/shared/getUser';
import db from '@/server/db';

const inputSchema = z.object({
  collectionId: z.string().uuid(),
});

const outputSchema = z.object({
  success: z.boolean(),
  demotedCount: z.number(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { collectionId } = input;

    const currentUser = await getUser(ctx.userId);
    const collection = await db.documentCollection.findUnique({
      where: { id: collectionId },
      select: { id: true, name: true, userId: true },
    });

    if (!collection) {
      throw NotFound('Collection not found');
    }

    // Mirrors the share path (promote-admin-document): admins, or the folder owner.
    if (ctx.userRole !== UserRole.Admin && collection.userId !== ctx.userId) {
      throw Forbidden('You do not have permission to modify this collection');
    }

    try {
      const { demotedCount } = await demoteCollection(collectionId);

      ctx.logger.info('Removed folder share status', { collectionId, demotedCount });

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `User ${currentUser?.name} demoted collection "${collection.name}" from admin data source (${demotedCount} documents)`,
        event: AuditRecordEvent.DemoteDocumentCollectionFromAdminDataSource,
      });

      return { success: true, demotedCount };
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `User ${currentUser?.name} failed to demote collection "${collection.name}" from admin data source - ${(error as Error).message}`,
        event: AuditRecordEvent.DemoteDocumentCollectionFromAdminDataSource,
      });
      throw error;
    }
  });
