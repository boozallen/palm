import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import getPulseJobsDal from '@/features/ai-agents/dal/pulse/getPulseJobs';

// An unfinished run is shown by the live progress display, not the run picker.
const LISTED_STATUSES = ['completed', 'error'] as const;

type ListedStatus = typeof LISTED_STATUSES[number];

function isListedStatus(status: string): status is ListedStatus {
  return (LISTED_STATUSES as readonly string[]).includes(status);
}

const input = z.object({ agentId: z.string().uuid() });

const output = z.object({
  jobs: z.array(z.object({
    id: z.string(),
    status: z.enum(LISTED_STATUSES),
    surveyFilename: z.string(),
    responseCount: z.number(),
    createdAt: z.date(),
  })),
});

export default procedure
  .input(input)
  .output(output)
  .query(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find((a) => a.id === input.agentId && a.type === AiAgentType.PULSE);

    if (!agent) {
      throw Forbidden('PULSE agent not found or access denied');
    }

    const jobs = await getPulseJobsDal(input.agentId, ctx.userId);

    return {
      jobs: jobs.flatMap((job) => (isListedStatus(job.status) ? [{ ...job, status: job.status }] : [])),
    };
  });
