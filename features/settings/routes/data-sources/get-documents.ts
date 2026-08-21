import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { DocumentSchema } from '@/features/shared/types/document';
import getAllDocumentsForAdmin from '@/features/shared/dal/document-library/upload/getAllDocumentsForAdmin';
import db from '@/server/db';

const inputSchema = z.object({
  documentUploadProviderId: z.string(),
});

const outputSchema = z.object({
  documents: z.array(DocumentSchema),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ ctx, input }) => {
    // Only Admins or Group Leads can access all documents
    if (ctx.userRole !== UserRole.Admin) {
      const leadMembership = await db.userGroupMembership.findFirst({
        where: { userId: ctx.userId, role: UserGroupRole.Lead },
      });
      if (!leadMembership) {
        throw Forbidden('You do not have permission to view all documents');
      }
    }

    const documents = await getAllDocumentsForAdmin({
      documentUploadProviderId: input.documentUploadProviderId,
    });

    return { documents };
  });
