import { z } from 'zod';
import { procedure } from '@/server/trpc';
import createAiAgent from '@/features/settings/dal/ai-agents/createAiAgent';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { AiAgentType } from '@/features/shared/types';

const inputSchema = z.object({
  label: z.string(),
  description: z.string(),
  type: z.nativeEnum(AiAgentType),
});

const outputSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  description: z.string(),
  type: z.nativeEnum(AiAgentType),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to create an AI agent.');
    }

    // Note: Pass label as name to DAL layer since database field is 'name'
    const result = await createAiAgent({
      name: input.label,
      description: input.description,
      type: input.type,
    });

    // Note: result.label maps to database field 'name' for consistency with UI naming convention
    const output: z.infer<typeof outputSchema> = {
      id: result.id,
      label: result.label,
      description: result.description,
      type: result.type,
    };

    return output;
  });
