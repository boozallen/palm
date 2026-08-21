import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import assignAdminDocumentGroups from '@/features/shared/dal/document-library/upload/assignAdminDocumentGroups';
import db from '@/server/db';

const inputSchema = z.object({
  documentId: z.string().uuid(),
  userGroupIds: z.array(z.string().uuid()),
});

const outputSchema = z.object({
  success: z.boolean(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { documentId, userGroupIds } = input;

    const document = await db.document.findUnique({
      where: { id: documentId },
      select: { id: true, adminCreated: true, userId: true },
    });

    if (!document || !document.adminCreated) {
      throw NotFound('Admin data source not found');
    }

    if (ctx.userRole !== UserRole.Admin) {
      const membership = await db.userGroupMembership.findFirst({
        where: { userId: ctx.userId, role: UserGroupRole.Lead },
      });
      if (!membership || document.userId !== ctx.userId) {
        throw Forbidden('You do not have permission to manage this data source');
      }
    }

    await db.$transaction(async (tx) => {
      await assignAdminDocumentGroups({ documentId, userGroupIds, tx });
    });

    return { success: true };
  });
