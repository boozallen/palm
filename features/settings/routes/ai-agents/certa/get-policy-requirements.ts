import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import generatePolicyRequirements from '@/features/settings/system-ai/ai-agents/certa/generatePolicyRequirements';

const inputSchema = z.object({
  policyContent: z.string(),
});

const outputSchema = z.object({
  requirements: z.string(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource.');
    }

    const result = await generatePolicyRequirements(
      ctx.ai,
      input.policyContent,
    );

    const output: z.infer<typeof outputSchema> = {
      requirements: result.requirements,
    };  
    return output;
  });
