import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { getModels } from '@/features/settings/dal/getModels';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { TOKEN_COST_RATE } from '@/features/shared/utils';

const outputSchema = z.object({
  models: z.array(
    z.object({
      id: z.string().uuid(),
      aiProviderId: z.string(),
      providerLabel: z.string(),
      name: z.string(),
      externalId: z.string(),
      costPerMillionInputTokens: z.number(),
      costPerMillionOutputTokens: z.number(),
    }),
  ),
});

export default procedure.output(outputSchema).query(async ({ ctx }) => {
  if (ctx.userRole !== UserRole.Admin) {
    throw Forbidden('You do not have permission to access this resource.');
  }

  const result = await getModels();

  return {
    models: result.map((model) => ({
      id: model.id,
      aiProviderId: model.aiProviderId,
      providerLabel: model.providerLabel,
      name: model.name,
      externalId: model.externalId,
      costPerMillionInputTokens: model.costPerInputToken * TOKEN_COST_RATE,
      costPerMillionOutputTokens: model.costPerOutputToken * TOKEN_COST_RATE,
    })),
  };
});
