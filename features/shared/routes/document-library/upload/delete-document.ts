import { z } from 'zod';
import { procedure } from '@/server/trpc';

import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import deleteDocument from '@/features/shared/dal/document-library/upload/deleteDocument';
import getDocument from '@/features/shared/dal/document-library/upload/getDocument';
import getActiveGraphBuilds from '@/features/graph-database/dal/getActiveGraphBuilds';

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

    const documentToDelete = await getDocument(documentId);

    // Admin data sources cannot be deleted by regular users
    if (documentToDelete?.adminCreated && ctx.userRole !== UserRole.Admin && ctx.userId !== documentToDelete.userId) {
      throw Forbidden('Admin data sources cannot be deleted by users');
    }

    // Only the owner or an Admin can delete a document
    if (documentToDelete && ctx.userRole !== UserRole.Admin && ctx.userId !== documentToDelete.userId) {
      ctx.logger.error(`You do not have permission to delete this document: userId: ${ctx.userId}, documentId: ${documentId}`);
      throw Forbidden('You do not have permission to delete this document');
    }

    const activeGraphBuilds = await getActiveGraphBuilds(ctx.userId);
    const isDocumentGraphing = activeGraphBuilds.some(build => 
      build.documentIds.includes(documentId)
    );

    if (isDocumentGraphing) {
      ctx.logger.error(`Cannot delete document while it is being graphed: documentId: ${documentId}`);
      throw Forbidden('Cannot delete document while it is being graphed');
    }

    const result = await deleteDocument(documentId);

    return {
      id: result.id,
    };
  });

