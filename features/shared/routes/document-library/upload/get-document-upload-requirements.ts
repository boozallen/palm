import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { RequirementNames } from '@/features/settings/types/system-requirements';
import getEmbeddingModel from '@/features/shared/dal/getEmbeddingModel';
import { tryGetRedisClient } from '@/server/storage/redisConnection';

const outputSchema = z.object({
  configured: z.boolean(),
  requirements: z.array(
    z.object({
      name: z.string(),
      available: z.boolean(),
    })
  ),
});

export default procedure.output(outputSchema).query(async ({ ctx }) => {
  const requirements: { name: string; available: boolean }[] = [];

  // Check embedding model availability — uploads embed their content, so a
  // designated embedding model is the actual precondition here. Scoped to this
  // user, since the designation lives on a provider their group must have.
  const embeddingModel = await getEmbeddingModel(ctx.userId);
  const embeddingModelAvailable = embeddingModel !== null;

  requirements.push({
    name: RequirementNames.BEDROCK_AI_PROVIDER,
    available: embeddingModelAvailable,
  });

  // Check Redis availability
  const redisClient = await tryGetRedisClient();
  const redisAvailable = !!redisClient;
  requirements.push({ name: RequirementNames.REDIS_INSTANCE, available: redisAvailable });

  const configured = requirements.every((requirement) => requirement.available);

  return {
    configured,
    requirements,
  };
});
