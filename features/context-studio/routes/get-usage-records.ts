import { procedure } from '@/server/trpc';
import { z } from 'zod';
import { InitiatedBy } from '@/features/context-studio/types/cost';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import getUsageRecords from '@/features/context-studio/dal/getUsageRecords';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const inputSchema = z.object({
  initiatedBy: z.nativeEnum(InitiatedBy),
  aiProvider: z.string().uuid().or(z.literal('all')),
  model: z.string().uuid().or(z.literal('all')),
  timeRange: z.nativeEnum(TimeRange),
  userGroupId: z.string().uuid().or(z.literal('all')),
  userId: z.string().uuid().or(z.literal('all')),
});

const modelCostSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  cost: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  costPerInputToken: z.number().optional(),
  costPerOutputToken: z.number().optional(),
});

const providerCostSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  cost: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  costPerInputToken: z.number().optional(),
  costPerOutputToken: z.number().optional(),
  models: z.array(modelCostSchema),
});

const outputSchema = z.object({
  initiatedBy: z.nativeEnum(InitiatedBy),
  aiProvider: z.string().optional(),
  model: z.string().optional(),
  timeRange: z.nativeEnum(TimeRange),
  userGroupLabel: z.string().optional(),
  userName: z.string().optional(),
  totalCost: z.number(),
  totalInputTokens: z.number(),
  totalOutputTokens: z.number(),
  providers: z.array(providerCostSchema),
  users: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    cost: z.number(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    providers: z.array(providerCostSchema),
  })).optional(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    // Cost is a Context Studio tab, so it inherits the studio's group-level grant
    // instead of the Admin role the standalone Analytics page checked. Selecting
    // a group always breaks spend out by member, so 'all' is forced down to the
    // viewer's own id unless they are an Admin or that group's Lead.
    const { restrictedUserId } = await scopeStudioQuery(ctx, input.userGroupId, input.userId);

    const result = await getUsageRecords(
      input.initiatedBy,
      input.aiProvider,
      input.model,
      input.timeRange,
      input.userGroupId,
      restrictedUserId,
    );

    return {
      initiatedBy: result.initiatedBy,
      aiProvider: result.aiProvider,
      model: result.model,
      timeRange: result.timeRange,
      userGroupLabel: result.userGroupLabel,
      userName: result.userName,
      totalCost: result.totalCost,
      totalInputTokens: result.totalInputTokens,
      totalOutputTokens: result.totalOutputTokens,
      providers: result.providers,
      users: result.users,
    };
  });
