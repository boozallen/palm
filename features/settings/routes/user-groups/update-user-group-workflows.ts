import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import updateUserGroupWorkflows from '@/features/settings/dal/user-groups/updateUserGroupWorkflows';

const inputSchema = z.object({
  userGroupId: z.string().uuid(),
  workflowsEnabled: z.boolean(),
});

const outputSchema = z.object({
  userGroup: z.object({
    id: z.string().uuid(),
    label: z.string(),
    workflowsEnabled: z.boolean(),
    updatedAt: z.date(),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { userGroupId, workflowsEnabled } = input;

    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(ctx.userId, userGroupId);
      if (!membership || membership.role !== UserGroupRole.Lead) {
        throw Forbidden('You do not have permission to access this resource');
      }
    }

    const result = await updateUserGroupWorkflows({
      userGroupId,
      workflowsEnabled,
    });

    const output: z.infer<typeof outputSchema> = {
      userGroup: {
        id: result.id,
        label: result.label,
        workflowsEnabled: result.workflowsEnabled,
        updatedAt: result.updatedAt,
      },
    };

    return output;
  });