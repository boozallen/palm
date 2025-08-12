import { z } from 'zod';
import { procedure } from '@/server/trpc';

import { Forbidden } from '@/features/shared/errors/routeErrors';
import deleteDocument from '@/features/shared/dal/document-upload/deleteDocument';
import getDocument from '@/features/shared/dal/document-upload/getDocument';

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

    if (documentToDelete && ctx.userId !== documentToDelete.userId) {
      ctx.logger.error(`You do not have permission to delete this document: userId: ${ctx.userId}, documentId: ${documentId}`);
      throw Forbidden('You do not have permission to delete this document');
    }

    const result = await deleteDocument(documentId);

    return {
      id: result.id,
    };
  });

