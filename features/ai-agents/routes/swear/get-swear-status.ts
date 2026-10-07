import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { storage } from '@/server/storage/redis';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { AnalysisStatus, AnalysisConfidence } from '@/features/ai-agents/types/swear/analysisItem';

const input = z.object({
  agentId: z.string().uuid(),
  jobId: z.string(),
});

const analysisItemSchema = z.object({
  category: z.string(),
  requirement: z.string(),
  status: z.nativeEnum(AnalysisStatus),
  confidence: z.nativeEnum(AnalysisConfidence),
  evidence: z.string(),
});

const analysisResultSchema = z.object({
  analysis: z.array(analysisItemSchema).nullable(),
  filename: z.string(),
});

const output = z.object({
  status: z.enum(['queued', 'processing', 'completed', 'error']),
  progress: z.string().optional(),
  results: analysisResultSchema.optional(),
  error: z.string().optional(),
});

export const getSwearStatus = procedure
  .input(input)
  .output(output)
  .query(async ({ ctx, input }) => {
    // Verify user has access to SWEAR agent
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find(
      (agent) => agent.id === input.agentId && agent.type === AiAgentType.SWEAR
    );

    if (!agent) {
      throw new Error('SWEAR agent not found or access denied');
    }

    const jobData = await storage.hgetall(`swear-job:${input.jobId}`);

    if (!jobData || !jobData.status) {
      throw new Error('Job not found');
    }

    const status = jobData.status as 'queued' | 'processing' | 'completed' | 'error';

    return {
      status,
      progress: jobData.progress,
      results: jobData.results ? JSON.parse(jobData.results) : undefined,
      error: jobData.error,
    };
  });
