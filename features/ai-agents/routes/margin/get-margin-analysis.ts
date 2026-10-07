/**
 * Route: Get Margin Analysis
 *
 * Returns a full MARGIN analysis record by agentId + analysisId.
 *
 * Frontend hook: features/ai-agents/api/margin/get-margin-analysis.ts
 */

import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { getMarginAnalysis } from '@/features/ai-agents/dal/margin';

const input = z.object({
  aiAgentId: z.string().uuid(),
  analysisId: z.string().uuid(),
});

export default procedure.input(input).query(async ({ ctx, input }) => {
  const agents = await getAvailableAgents(ctx.userId);
  const agent = agents.find(
    (a) => a.id === input.aiAgentId && a.type === AiAgentType.MARGIN,
  );

  if (!agent) {
    throw new Error('MARGIN agent not found');
  }

  const record = await getMarginAnalysis(input.aiAgentId, input.analysisId);

  if (!record) {
    throw new Error('Analysis not found');
  }

  return record;
});
