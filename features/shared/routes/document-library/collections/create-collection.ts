import { z } from 'zod';

import { procedure } from '@/server/trpc';
import createCollection from '@/features/shared/dal/document-library/collections/createCollection';

const inputSchema = z.object({
  name: z.string().min(1).max(100),
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
    const collection = await createCollection({
      ...input,
      userId,
    });

    return collection;
  });
