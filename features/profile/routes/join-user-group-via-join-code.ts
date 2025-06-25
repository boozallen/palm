import { z } from 'zod';
import { procedure } from '@/server/trpc';
import getUser from '@/features/settings/dal/getUser';
import { getUserGroupByJoinCode } from '@/features/profile/dal/getUserGroupByJoinCode';
import createUserGroupMembership from '@/features/shared/dal/createUserGroupMembership';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { BadRequest, NotFound } from '@/features/shared/errors/routeErrors';
import getUserGroups from '@/features/profile/dal/getUserGroups';

const inputSchema = z.object({
  joinCode: z.string(),
});

const outputSchema = z.object({
  userGroupId: z.string(),
  label: z.string(),
  userId: z.string(),
  name: z.string(),
  role: z.nativeEnum(UserGroupRole),
  email: z.string().email().nullable(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const { joinCode } = input;

    const currentUser = await getUser(ctx.userId);
    const group = await getUserGroupByJoinCode(joinCode);

    if (!group) {
      ctx.auditor.createAuditRecord({
        outcome: 'ERROR',
        description: `User ${currentUser?.name} attempted invalid user group join code ${joinCode}`,
        event: 'CREATE_USER_GROUP_MEMBERSHIP',
      });
      throw NotFound('The code you entered is invalid or expired.');
    }

    const currentGroups = await getUserGroups(ctx.userId);
    const isAlreadyMember = currentGroups.filter((g) => g.id === group.id).length > 0;

    if (isAlreadyMember) {
      throw BadRequest(`You are already a member of the ${group.label} user group.`);
    }

    try {
      const result = await createUserGroupMembership(group.id, ctx.userId, UserGroupRole.User);

      ctx.auditor.createAuditRecord({
        outcome: 'SUCCESS',
        description: `User ${currentUser?.name} joined user group ${group.label} via join code`,
        event: 'CREATE_USER_GROUP_MEMBERSHIP',
      });

      const output: z.infer<typeof outputSchema> = {
        userGroupId: result.userGroupId,
        label: group.label,
        userId: result.userId,
        name: result.name,
        role: result.role,
        email: result.email,
      };
      return output;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: 'ERROR',
        description: `User ${currentUser?.name} failed to join user group ${group.label
          } despite valid join code: ${(error as Error).message}`,
        event: 'CREATE_USER_GROUP_MEMBERSHIP',
      });

      throw new Error('Error creating user group membership');
    }
  });
