import { z } from 'zod';

import { procedure } from '@/server/trpc';
import removeDocumentFromCollection from '@/features/shared/dal/document-library/collections/removeDocumentFromCollection';

const inputSchema = z.object({
  documentId: z.string(),
  collectionId: z.string(),
});

const outputSchema = z.object({
  success: z.boolean(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { userId } = ctx;
    const result = await removeDocumentFromCollection({
      ...input,
      userId,
    });

    return result;
  });
