import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import updateAiAgent from '@/features/settings/dal/ai-agents/updateAiAgent';
import { AiAgentType } from '@/features/shared/types';

const inputSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  type: z.nativeEnum(AiAgentType),
});

const outputSchema = z.object({
  aiAgent: z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string(),
    type: z.nativeEnum(AiAgentType),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource.');
    }

    const result = await updateAiAgent(input);

    const output: z.infer<typeof outputSchema> = {
      aiAgent: {
        id: result.id,
        name: result.name,
        description: result.description,
        type: result.type,
      },
    };

    return output;
  });
