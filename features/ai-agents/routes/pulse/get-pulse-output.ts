import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import getPulseJobOutput from '@/features/ai-agents/dal/pulse/getPulseJobOutput';

const input = z.object({
  agentId: z.string().uuid(),
  jobId: z.string().uuid(),
  output: z.enum(['dashboard', 'slides', 'pdf']),
});

const output = z.object({
  output: z.enum(['dashboard', 'slides', 'pdf']),
  mimeType: z.enum(['text/html', 'application/pdf']),
  encoding: z.enum(['utf8', 'base64']),
  content: z.string(),
});

/**
 * One stored output body, read only when the user downloads it so the run view
 * stays small. The PDF is bytes, so it travels as base64 inside the JSON response.
 */
export default procedure
  .input(input)
  .output(output)
  .query(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find((a) => a.id === input.agentId && a.type === AiAgentType.PULSE);

    if (!agent) {
      throw Forbidden('PULSE agent not found or access denied');
    }

    const body = await getPulseJobOutput(input.jobId, ctx.userId, input.agentId, input.output);

    if (body === null) {
      throw NotFound('PULSE output not found');
    }

    if (typeof body === 'string') {
      return {
        output: input.output,
        mimeType: 'text/html' as const,
        encoding: 'utf8' as const,
        content: body,
      };
    }

    return {
      output: input.output,
      mimeType: 'application/pdf' as const,
      encoding: 'base64' as const,
      content: body.toString('base64'),
    };
  });
