import { z } from 'zod';

import { procedure } from '@/server/trpc';
import deleteCollection from '@/features/shared/dal/document-library/collections/deleteCollection';

const inputSchema = z.object({
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
    const result = await deleteCollection({
      collectionId: input.collectionId,
      userId,
    });

    return result;
  });
