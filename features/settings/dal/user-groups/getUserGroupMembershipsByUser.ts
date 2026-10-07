import db from '@/server/db';
import logger from '@/server/logger';
import { UserGroupRole } from '@/features/shared/types/user-group';

type UserGroupMembershipByUser = {
  userGroupId: string;
  role: UserGroupRole;
};

/**
 * Gets the user group id and role for every group the given user belongs to
 * @param {string} userId
 */
export default async function getUserGroupMembershipsByUser(
  userId: string
): Promise<UserGroupMembershipByUser[]> {
  try {
    const memberships = await db.userGroupMembership.findMany({
      where: { userId },
      select: { userGroupId: true, role: true },
    });

    return memberships.map((membership) => ({
      userGroupId: membership.userGroupId,
      role: membership.role as UserGroupRole,
    }));
  } catch (error) {
    logger.error('Error getting user group memberships by user', error);
    throw new Error('Error getting user group memberships by user');
  }
}
