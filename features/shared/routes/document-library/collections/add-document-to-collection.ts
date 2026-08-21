import { z } from 'zod';

import { procedure } from '@/server/trpc';
import addDocumentToCollection from '@/features/shared/dal/document-library/collections/addDocumentToCollection';

const inputSchema = z.object({
  documentId: z.string(),
  collectionId: z.string(),
});

const outputSchema = z.object({
  documentId: z.string(),
  collectionId: z.string(),
  addedAt: z.date(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { userId } = ctx;
    const membership = await addDocumentToCollection({
      ...input,
      userId,
    });

    return membership;
  });
