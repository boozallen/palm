import logger from '@/server/logger';
import db from '@/server/db';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

type UpdateUserGroupMemberRole = {
  userGroupId: string;
  userId: string;
  role: UserGroupRole;
};

export default async function updateUserGroupMemberRole(
  input: UpdateUserGroupMemberRole
) {
  try {
    const updateResult = await db.userGroupMembership.update({
      where: {
        userGroupId_userId: {
          userGroupId: input.userGroupId,
          userId: input.userId,
        },
      },
      data: {
        role: input.role,
      },
    });
    return {
      role: updateResult.role,
      userGroupId: input.userGroupId,
      userId: input.userId,
    };
  } catch (error) {
    logger.error('Error updating user group member role', error);

    throw new Error(handlePrismaError(error));
  }
}
