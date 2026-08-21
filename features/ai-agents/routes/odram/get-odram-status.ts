import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { storage } from '@/server/storage/redis';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import {
  OdramRiskRating,
} from '@/features/ai-agents/types/odram/analysisResult';

const input = z.object({
  agentId: z.string().uuid(),
  jobId: z.string(),
});

const questionResultSchema = z.object({
  questionId: z.number(),
  questionName: z.string(),
  independentRating: z.nativeEnum(OdramRiskRating),
  overallAssessment: z.string(),
  keyFeedback: z.array(z.string()),
  teamRating: z.string(),
});

const analysisResultSchema = z.object({
  questions: z.array(questionResultSchema),
  summary: z.string().nullable(),
});

const output = z.object({
  status: z.enum(['queued', 'processing', 'completed', 'error']),
  progress: z.string().optional(),
  currentQuestion: z.number().optional(),
  totalQuestions: z.number().optional(),
  partialResults: z.array(questionResultSchema).optional(),
  results: analysisResultSchema.optional(),
  error: z.string().optional(),
});

export const getOdramStatus = procedure
  .input(input)
  .output(output)
  .query(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find(
      (agent) => agent.id === input.agentId && agent.type === AiAgentType.ODRAM,
    );

    if (!agent) {
      throw new Error('ODRAM agent not found or access denied');
    }

    const jobData = await storage.hgetall(`odram-job:${input.jobId}`);

    if (!jobData || !jobData.status) {
      throw new Error('Job not found');
    }

    const status = jobData.status as 'queued' | 'processing' | 'completed' | 'error';

    let partialResults;
    if (jobData.partialResults) {
      try {
        partialResults = JSON.parse(jobData.partialResults);
      } catch {
        partialResults = undefined;
      }
    }

    return {
      status,
      progress: jobData.progress,
      currentQuestion: jobData.currentQuestion ? Number(jobData.currentQuestion) : undefined,
      totalQuestions: jobData.totalQuestions ? Number(jobData.totalQuestions) : undefined,
      partialResults,
      results: jobData.results ? JSON.parse(jobData.results) : undefined,
      error: jobData.error,
    };
  });
