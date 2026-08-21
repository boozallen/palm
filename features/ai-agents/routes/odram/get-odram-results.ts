import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import {
  OdramRiskRating,
} from '@/features/ai-agents/types/odram/analysisResult';
import getOdramResults from '@/features/ai-agents/dal/odram/getOdramResults';
import db from '@/server/db';

const input = z.object({
  agentId: z.string().uuid(),
  jobId: z.string().uuid(),
});

const questionResultSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  questionId: z.number(),
  questionName: z.string(),
  teamRating: z.string(),
  independentRating: z.nativeEnum(OdramRiskRating),
  overallAssessment: z.string(),
  keyFeedback: z.string(),
  sortOrder: z.number(),
});

const output = z.object({
  summary: z.string().nullable(),
  results: z.array(questionResultSchema),
});

export default procedure
  .input(input)
  .output(output)
  .query(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find(
      (a) => a.id === input.agentId && a.type === AiAgentType.ODRAM,
    );

    if (!agent) {
      throw new Error('ODRAM agent not found or access denied');
    }

    const job = await db.agentOdramJob.findFirst({
      where: { id: input.jobId, userId: ctx.userId },
    });

    if (!job) {
      throw new Error('Job not found or access denied');
    }

    const { summary, results: rows } = await getOdramResults(input.jobId);

    const results = rows.map((r) => ({
      id: r.id,
      jobId: r.jobId,
      questionId: r.questionId,
      questionName: r.questionName,
      teamRating: r.teamRating,
      independentRating: r.independentRating as OdramRiskRating,
      overallAssessment: r.overallAssessment,
      keyFeedback: r.keyFeedback,
      sortOrder: r.sortOrder,
    }));

    return { summary, results };
  });
