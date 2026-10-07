import { z } from 'zod';

import { isFeatureOn } from '@/libs/featureFlags';
import { procedure } from '@/server/trpc';

const inputSchema = z.object({
  feature: z.string(),
});

const outputSchema = z.object({
  isFeatureOn: z.boolean(),
});

const getFeatureFlag = procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(({ input }) => {
    return { isFeatureOn: isFeatureOn(input.feature) };
  });

export default getFeatureFlag;
