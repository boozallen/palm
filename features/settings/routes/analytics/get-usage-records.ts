import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { z } from 'zod';
import { InitiatedBy, TimeRange } from '@/features/settings/types/analytics';
import getUsageRecords from '@/features/settings/dal/analytics/getUsageRecords';

const inputSchema = z.object({
  initiatedBy: z.nativeEnum(InitiatedBy),
  aiProvider: z.string().uuid().or(z.literal('all')),
  model: z.string().uuid().or(z.literal('all')),
  timeRange: z.nativeEnum(TimeRange),
});

const outputSchema = z.object({
  initiatedBy: z.nativeEnum(InitiatedBy),
  aiProvider: z.string().optional(),
  model: z.string().optional(),
  timeRange: z.nativeEnum(TimeRange),
  totalCost: z.number(),
  providers: z.array(z.object({
    id: z.string().uuid(),
    label: z.string(),
    cost: z.number(),
    models: z.array(z.object({
      id: z.string().uuid(),
      label: z.string(),
      cost: z.number(),
    })),
  })),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const result = await getUsageRecords(
      input.initiatedBy,
      input.aiProvider,
      input.model,
      input.timeRange
    );

    const output: z.infer<typeof outputSchema> = {
      initiatedBy: result.initiatedBy,
      aiProvider: result.aiProvider,
      model: result.model,
      timeRange: result.timeRange,
      totalCost: result.totalCost,
      providers: result.providers,
    };

    return output;
  });
