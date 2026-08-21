import { z } from 'zod';

import getBedrockModelAccess from '@/features/shared/dal/getBedrockModelAccess';
import { procedure } from '@/server/trpc';

const outputSchema = z.object({
  hasAccess: z.boolean(),
});

export default procedure.output(outputSchema).query(async ({ ctx }) => {
  const hasAccess = await getBedrockModelAccess(ctx.userId);

  return { hasAccess };
});
