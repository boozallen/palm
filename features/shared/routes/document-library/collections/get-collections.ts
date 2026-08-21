import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getCollections from '@/features/shared/dal/document-library/collections/getCollections';

const outputSchema = z.object({
  collections: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      color: z.string().nullable(),
      userId: z.string(),
      createdAt: z.date(),
      updatedAt: z.date(),
      documentCount: z.number(),
    })
  ),
});

export default procedure.output(outputSchema).query(async ({ ctx }) => {
  const { userId } = ctx;
  const collections = await getCollections({ userId });

  return { collections };
});
