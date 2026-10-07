import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getDocumentCollections from '@/features/shared/dal/document-library/collections/getDocumentCollections';

const inputSchema = z.object({
  documentId: z.string(),
});

const outputSchema = z.object({
  collections: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      color: z.string().nullable(),
      userId: z.string(),
      createdAt: z.date(),
      updatedAt: z.date(),
    })
  ),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ ctx, input }) => {
    const { userId } = ctx;
    const collections = await getDocumentCollections({
      documentId: input.documentId,
      userId,
    });

    return { collections };
  });
