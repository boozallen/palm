import db from '@/server/db';
import logger from '@/server/logger';
import { UserGroupRole } from '@/features/shared/types/user-group';

type UserGroupMembership = {
  userGroupId: string;
  userId: string;
  role: UserGroupRole;
};

export default async function getUserGroupMembership(
  userId: string,
  userGroupId: string,
): Promise<UserGroupMembership | null> {
  try {
    const userGroupMembership = await db.userGroupMembership.findUnique({
      where: {
        userGroupId_userId: {
          userGroupId,
          userId,
        },
      },
    });

    if (!userGroupMembership) {
      return null;
    }

    return {
      userGroupId: userGroupMembership.userGroupId,
      userId: userGroupMembership.userId,
      role: userGroupMembership.role as UserGroupRole,
    };
  } catch (error) {
    logger.error('Error getting user group membership role', error);
    throw new Error('Error getting user group membership role');
  }
}
