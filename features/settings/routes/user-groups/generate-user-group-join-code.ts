import * as crypto from 'crypto';
import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import {
  UserGroupRole,
  userGroupSchema,
} from '@/features/shared/types/user-group';
import updateUserGroupJoinCode from '@/features/settings/dal/user-groups/updateUserGroupJoinCode';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';

const inputSchema = z.object({
  userGroupId: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(userGroupSchema)
  .mutation(async ({ input, ctx }) => {
    const { userGroupId } = input;

    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(ctx.userId, userGroupId);
      if (!membership || membership.role !== UserGroupRole.Lead) {
        throw Forbidden('You do not have permission to access this resource');
      }
    }

    try {
      const codeLength = 8;
      const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const num = '1234567890';
      const valid = `${alpha}${alpha.toLowerCase()}${num}`;

      const joinCode = new Array(codeLength)
        .fill(0)
        .map(() => valid[crypto.randomInt(0, valid.length - 1)])
        .join('');
      const result = await updateUserGroupJoinCode({
        id: userGroupId,
        joinCode,
      });

      return result;
    } catch (cause) {
      ctx.logger.error(
        `Error generating user group join code for group ${userGroupId}`,
        { cause },
      );
      throw new Error('Error generating user group join code');
    }
  });
