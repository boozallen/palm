import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { getRateCardCategoriesForDisplay } from '@/features/ai-agents/dal/rcast';

const input = z.object({
  aiAgentId: z.string().uuid(),
  rateCardId: z.string().uuid(),
});

export default procedure.input(input).query(async ({ ctx, input }) => {
  const agents = await getAvailableAgents(ctx.userId);
  const agent = agents.find(
    (agent) => agent.id === input.aiAgentId && agent.type === AiAgentType.RCAST
  );

  if (!agent) {
    throw new Error('RCAST-TWO agent not found');
  }

  const categories = await getRateCardCategoriesForDisplay(
    input.rateCardId,
    input.aiAgentId
  );

  if (categories === null) {
    throw new Error('Rate card not found');
  }

  return categories;
});
