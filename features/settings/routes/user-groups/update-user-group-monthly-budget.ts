import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import updateUserGroupMonthlyBudget from '@/features/settings/dal/user-groups/updateUserGroupMonthlyBudget';
import getUser from '@/features/settings/dal/shared/getUser';

const inputSchema = z.object({
  userGroupId: z.string().uuid(),
  monthlyBudget: z.number().finite().min(0).nullable(),
});

const outputSchema = z.object({
  userGroup: z.object({
    id: z.string().uuid(),
    label: z.string(),
    monthlyBudget: z.number().nullable(),
    updatedAt: z.date(),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { userGroupId, monthlyBudget } = input;

    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(ctx.userId, userGroupId);
      if (!membership || membership.role !== UserGroupRole.Lead) {
        throw Forbidden('You do not have permission to access this resource');
      }
    }

    const currentUser = await getUser(ctx.userId);

    try {
      const result = await updateUserGroupMonthlyBudget({
        userGroupId,
        monthlyBudget,
      });

      const output: z.infer<typeof outputSchema> = {
        userGroup: {
          id: result.id,
          label: result.label,
          monthlyBudget: result.monthlyBudget,
          updatedAt: result.updatedAt,
        },
      };

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: monthlyBudget === null
          ? `${currentUser?.name} cleared the monthly budget for user group "${result.label}"`
          : `${currentUser?.name} set the monthly budget for user group "${result.label}" to $${monthlyBudget}`,
        event: AuditRecordEvent.ModifyUserGroupMonthlyBudget,
      });

      return output;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `${currentUser?.name} failed to update the monthly budget for user group ${userGroupId}: ${(error as Error).message}`,
        event: AuditRecordEvent.ModifyUserGroupMonthlyBudget,
      });
      throw error;
    }
  });
