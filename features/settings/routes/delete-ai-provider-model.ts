import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { TRPCError } from '@trpc/server';
import deleteAiProviderModel from '@/features/settings/dal/deleteAiProviderModel';
import updateSystemConfigDefaultModel from '../dal/updateSystemConfigDefaultModel';

const inputSchema = z.object({
  modelId: z.string().uuid(),
});

const outputSchema = z.object({
  id: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { modelId } = input;

    if (ctx.userRole !== UserRole.Admin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource',
      });
    }

    const deletedModel = await deleteAiProviderModel(modelId);

    await updateSystemConfigDefaultModel();

    return {
      id: deletedModel.id,
    };
  });
