import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { ComplianceStatus } from '@/features/ai-agents/types/prism/complianceResult';
import getPrismResults from '@/features/ai-agents/dal/prism/getPrismResults';
import db from '@/server/db';

const input = z.object({
  agentId: z.string().uuid(),
  jobId: z.string().uuid(),
});

const resultSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  category: z.string().nullable(),
  requirement: z.string(),
  complianceStatus: z.nativeEnum(ComplianceStatus),
  reasoning: z.string(),
  citations: z.string().nullable(),
  sortOrder: z.number(),
});

const output = z.object({
  results: z.array(resultSchema),
});

export default procedure
  .input(input)
  .output(output)
  .query(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find(
      (a) => a.id === input.agentId && a.type === AiAgentType.PRISM,
    );

    if (!agent) {
      throw new Error('PRISM agent not found or access denied');
    }

    // Verify the job belongs to this user
    const job = await db.agentPrismJob.findFirst({
      where: { id: input.jobId, userId: ctx.userId },
    });

    if (!job) {
      throw new Error('Job not found or access denied');
    }

    const rows = await getPrismResults(input.jobId);

    const results = rows.map((r) => ({
      id: r.id,
      jobId: r.jobId,
      category: r.category,
      requirement: r.requirement,
      complianceStatus: r.complianceStatus as ComplianceStatus,
      reasoning: r.reasoning,
      citations: r.citations,
      sortOrder: r.sortOrder,
    }));

    return { results };
  });
