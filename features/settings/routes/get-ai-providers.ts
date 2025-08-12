import { z } from 'zod';
import { procedure } from '@/server/trpc';
import getAiProviders from '@/features/settings/dal/getAiProviders';
import { TRPCError } from '@trpc/server';
import { UserRole } from '@/features/shared/types/user';
import getIsUserGroupLead from '@/features/shared/dal/getIsUserGroupLead';

const inputSchema = z.object({});

const outputSchema = z.object({
  aiProviders: z.array(z.object({
    id: z.string().uuid(),
    label: z.string(),
    typeId: z.number().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })),
});

type GetAiProvidersOutput = z.infer<typeof outputSchema>;

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      const lead = await getIsUserGroupLead(ctx.userId);
      if (!lead) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource.',
        });
      }
    }

    const results = await getAiProviders();

    const output: GetAiProvidersOutput = {
      aiProviders: [],
    };

    for (const result of results) {
      output.aiProviders.push({
        id: result.id,
        label: result.label,
        typeId: result.typeId,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      });
    }

    return output;
  });
