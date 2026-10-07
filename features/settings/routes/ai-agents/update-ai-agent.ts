import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import updateAiAgent from '@/features/settings/dal/ai-agents/updateAiAgent';
import { AiAgentType } from '@/features/shared/types';

const inputSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  description: z.string(),
  type: z.nativeEnum(AiAgentType),
});

const outputSchema = z.object({
  aiAgent: z.object({
    id: z.string().uuid(),
    label: z.string(),
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

    // Note: Pass label as name to DAL layer since database field is 'name'
    const result = await updateAiAgent({
      id: input.id,
      name: input.label,
      description: input.description,
      type: input.type,
    });

    // Note: result.label maps to database field 'name' for consistency with UI naming convention
    const output: z.infer<typeof outputSchema> = {
      aiAgent: {
        id: result.id,
        label: result.label,
        description: result.description,
        type: result.type,
      },
    };

    return output;
  });
