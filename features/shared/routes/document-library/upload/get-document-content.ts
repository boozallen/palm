import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getDocument from '@/features/shared/dal/document-library/upload/getDocument';
import { NotFound } from '@/features/shared/errors/routeErrors';
import assertDocumentAccess from '@/features/shared/utils/assertDocumentAccess';

const inputSchema = z.object({
  documentId: z.string().uuid(),
});

const outputSchema = z.object({
  id: z.string().uuid(),
  text: z.string().nullable(),
});

export default procedure.input(inputSchema).output(outputSchema)
  .query(async ({ ctx, input }) => {
    await assertDocumentAccess(ctx, input.documentId);

    const document = await getDocument(input.documentId);

    if (!document) {
      throw NotFound('Document not found');
    }

    return {
      id: document.id,
      text: document.text ?? null,
    };
  });
