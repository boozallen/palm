import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { RequirementNames } from '@/features/settings/types/system-requirements';
import getFirstAvailableBedrockModel from '@/features/settings/dal/ai-providers/getFirstAvailableBedrockModel';
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

export default procedure.output(outputSchema).query(async () => {
  const requirements: { name: string; available: boolean }[] = [];

  // Check Bedrock model availability
  const bedrockModel = await getFirstAvailableBedrockModel();
  const bedrockModelAvailable = bedrockModel !== null;

  requirements.push({
    name: RequirementNames.BEDROCK_AI_PROVIDER,
    available: bedrockModelAvailable,
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
