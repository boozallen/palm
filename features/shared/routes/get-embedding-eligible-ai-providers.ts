import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getEmbeddingEligibleAiProviderIds from '@/features/shared/dal/getEmbeddingEligibleAiProviderIds';

const outputSchema = z.object({
  aiProviderIds: z.array(z.string()),
});

export default procedure
  .output(outputSchema)
  .query(async () => {
    const aiProviderIds = await getEmbeddingEligibleAiProviderIds();

    return { aiProviderIds };
  });
