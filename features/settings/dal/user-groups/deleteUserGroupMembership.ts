import db from '@/server/db';
import logger from '@/server/logger';
import { UserGroupRole, UserGroupMembership } from '@/features/shared/types/user-group';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

export default async function deleteUserGroupMembership(userGroupId: string, userId: string):
  Promise<UserGroupMembership> {
  try {
    const userGroupMembership = await db.userGroupMembership.delete({
      where: {
        userGroupId_userId: {
          userGroupId,
          userId,
        },
      },
      include: { user: true },
    });

    return {
      userGroupId: userGroupMembership.userGroupId,
      userId: userGroupMembership.userId,
      name: userGroupMembership.user.name,
      role: userGroupMembership.role as UserGroupRole,
      email: userGroupMembership.user.email,
      lastLoginAt: userGroupMembership.user.lastLoginAt,
    };

  } catch (error) {
    logger.error('Error deleting user group membership', error);
    throw new Error(handlePrismaError(error));
  }
}
