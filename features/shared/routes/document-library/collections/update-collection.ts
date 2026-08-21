import { z } from 'zod';

import { procedure } from '@/server/trpc';
import updateCollection from '@/features/shared/dal/document-library/collections/updateCollection';

const inputSchema = z.object({
  collectionId: z.string(),
  name: z.string().min(1).max(100).optional(),
  color: z.string().optional(),
});

const outputSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  userId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { userId } = ctx;
    const collection = await updateCollection({
      ...input,
      userId,
    });

    return collection;
  });
