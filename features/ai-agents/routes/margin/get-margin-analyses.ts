/**
 * Route: Get Margin Analyses
 *
 * Returns summary list of past MARGIN analyses for an agent.
 *
 * Frontend hook: features/ai-agents/api/margin/get-margin-analyses.ts
 */

import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { getMarginAnalysesForAgent } from '@/features/ai-agents/dal/margin';

const input = z.object({
  aiAgentId: z.string().uuid(),
});

export default procedure.input(input).query(async ({ ctx, input }) => {
  const agents = await getAvailableAgents(ctx.userId);
  const agent = agents.find(
    (a) => a.id === input.aiAgentId && a.type === AiAgentType.MARGIN,
  );

  if (!agent) {
    throw new Error('MARGIN agent not found');
  }

  return getMarginAnalysesForAgent(input.aiAgentId);
});
