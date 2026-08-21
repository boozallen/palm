import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getUserProvidedGraphDocuments from '@/features/graph-database/dal/getUserProvidedGraphDocuments';

const outputSchema = z.object({
  // Document IDs that will be ingested as a native palm-graph (user-provided)
  // rather than run through LLM extraction.
  userProvidedDocumentIds: z.array(z.string().uuid()),
});

export default procedure
  .output(outputSchema)
  .query(async ({ ctx }) => {
    const userProvidedDocumentIds = await getUserProvidedGraphDocuments(ctx.userId);
    return { userProvidedDocumentIds };
  });
