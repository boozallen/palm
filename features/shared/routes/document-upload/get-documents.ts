import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getDocuments from '@/features/shared/dal/document-upload/getDocuments';
import { DocumentSchema } from '@/features/shared/types/document';
import { BadRequest } from '@/features/shared/errors/routeErrors';

const inputSchema = z.object({
  documentUploadProviderId: z.string(),
});

const outputSchema = z.object({
  documents: z.array(DocumentSchema),
});

export default procedure.input(inputSchema).output(outputSchema)
.query(async ({ ctx, input }) => {
  const { userId } = ctx;
  const { documentUploadProviderId } = input;

    if (!documentUploadProviderId) {
      throw BadRequest('Requires a valid document upload provider');
    }

    const results = await getDocuments({ userId, documentUploadProviderId });

    return {
      documents: results.map((document) => ({
        id: document.id,
        userId: document.userId,
        filename: document.filename,
        createdAt: document.createdAt,
        uploadStatus: document.uploadStatus,
      })),
    };
  });
