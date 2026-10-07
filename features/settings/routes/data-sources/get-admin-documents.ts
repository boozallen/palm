import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { AdminDocumentSchema } from '@/features/shared/types/document';
import getAdminDocuments from '@/features/shared/dal/document-library/upload/getAdminDocuments';
import db from '@/server/db';

const outputSchema = z.object({
  documents: z.array(AdminDocumentSchema),
});

export default procedure
  .output(outputSchema)
  .query(async ({ ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      const leadMembership = await db.userGroupMembership.findFirst({
        where: { userId: ctx.userId, role: UserGroupRole.Lead },
      });
      if (!leadMembership) {
        throw Forbidden('You do not have permission to view admin data sources');
      }
    }

    const documents = await getAdminDocuments({ userId: ctx.userId, isAdmin: ctx.userRole === UserRole.Admin });

    return { documents };
  });
