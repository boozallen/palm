import db from '@/server/db';
import logger from '@/server/logger';
import { UserGroup, UserGroupRole } from '@/features/shared/types/user-group';

/**
 * Gets all user groups where the user is a lead.
 * @param {string} userId
 */

export default async function getUserGroupsAsLead(userId: string): Promise<UserGroup[]> {
  try {
    const results = await db.userGroup.findMany({
      where: {
        userGroupMemberships: {
          some: {
            userId,
            role: UserGroupRole.Lead,
          },
        },
      },
      include: {
        _count: {
          select: {
            userGroupMemberships: true,
          },
        },
      },
    });

    return results.map(
      (userGroup): UserGroup => ({
        id: userGroup.id,
        label: userGroup.label,
        createdAt: userGroup.createdAt,
        updatedAt: userGroup.updatedAt,
        memberCount: userGroup._count.userGroupMemberships,
      })
    );
  } catch (error) {
    logger.error('Error getting user groups as lead', error);
    throw new Error('Error getting user groups as lead');
  }
}
