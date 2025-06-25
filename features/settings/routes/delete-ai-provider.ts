import { z } from 'zod';
import { procedure } from '@/server/trpc';
import deleteAiProvider from '@/features/settings/dal/deleteAiProvider';
import { TRPCError } from '@trpc/server';
import { UserRole } from '@/features/shared/types/user';
import updateSystemConfigDefaultModel from '@/features/settings/dal/updateSystemConfigDefaultModel';

const inputSchema = z.object({
  providerId: z.string().uuid(),
});

const outputSchema = z.object({
  id: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { providerId } = input;

    if (ctx.userRole !== UserRole.Admin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource',
      });
    }

    const result = await deleteAiProvider(providerId);
    await updateSystemConfigDefaultModel();

    return result;
  });

