import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import updateUserGroupAiAgents from '@/features/settings/dal/user-groups/updateUserGroupAiAgents';
import getUser from '@/features/settings/dal/shared/getUser';
import db from '@/server/db';

const inputSchema = z.object({
  userGroupId: z.string().uuid(),
  aiAgentId: z.string().uuid(),
  enabled: z.boolean(),
});

const outputSchema = z.object({
  userGroupAiAgents: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      description: z.string(),
    })
  ),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { userGroupId, aiAgentId, enabled } = input;

    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(ctx.userId, userGroupId);
      if (!membership || membership.role !== UserGroupRole.Lead) {
        throw Forbidden('You do not have permission to access this resource');
      }
    }

    const currentUser = await getUser(ctx.userId);
    const [userGroup, aiAgent] = await Promise.all([
      db.userGroup.findUnique({ where: { id: userGroupId }, select: { label: true } }),
      db.aiAgent.findUnique({ where: { id: aiAgentId }, select: { name: true } }),
    ]);

    try {
      const result = await updateUserGroupAiAgents({
        userGroupId,
        aiAgentId,
        enabled,
      });

      const output: z.infer<typeof outputSchema> = {
        userGroupAiAgents: result.map((agent) => ({
          id: agent.id,
          name: agent.name,
          description: agent.description,
        })),
      };

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `${currentUser?.name} ${enabled ? 'enabled' : 'disabled'} AI agent "${aiAgent?.name}" for user group "${userGroup?.label}"`,
        event: AuditRecordEvent.ModifyUserGroupAiAgentAccess,
      });

      return output;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `${currentUser?.name} failed to ${enabled ? 'enable' : 'disable'} AI agent "${aiAgent?.name}" for user group "${userGroup?.label}": ${(error as Error).message}`,
        event: AuditRecordEvent.ModifyUserGroupAiAgentAccess,
      });
      throw error;
    }
  });
