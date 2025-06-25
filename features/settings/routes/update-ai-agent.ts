import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import updateAiAgent from '@/features/settings/dal/updateAiAgent';

const inputSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean(),
});

const outputSchema = z.object({
  aiAgent: z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string(),
    enabled: z.boolean(),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource.');
    }

    const result = await updateAiAgent(input.id, input.enabled);

    const output: z.infer<typeof outputSchema> = {
      aiAgent: {
        id: result.id,
        name: result.name,
        description: result.description,
        enabled: result.enabled,
      },
    };
    
    return output;
  });
