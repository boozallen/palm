import db from '@/server/db';
import logger from '@/server/logger';
import { UserGroupMembership, UserGroupRole } from '@/features/shared/types/user-group';

export default async function getUserGroupMemberships(id: string): Promise<UserGroupMembership[]> {
  try {
    const userGroupMemberships = await db.userGroupMembership.findMany({
      where: {
        userGroupId: id,
      },
      include: {
        user: true,
      },
    });

    const memberships = userGroupMemberships.map((membership) => {
      return {
        userGroupId: membership.userGroupId,
        userId: membership.userId,
        name: membership.user.name,
        role: membership.role as UserGroupRole,
        email: membership.user.email,
      };
    });

    return memberships;

  } catch (error) {
    logger.error('Error getting user group memberships', error);
    throw new Error('Error getting user group memberships');
  }
};
