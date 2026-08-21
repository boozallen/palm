import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import { tryGetRedisClient } from '@/server/storage/redisConnection';
import { RequirementNames } from '@/features/settings/types/system-requirements';

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
  if (ctx.userRole !== UserRole.Admin) {
    throw Unauthorized('You do not have permission to access this resource');
  }

  const requirements: { name: string; available: boolean }[] = [];

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
