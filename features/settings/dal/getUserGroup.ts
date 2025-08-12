import { UserGroup } from '@/features/shared/types/user-group';
import logger from '@/server/logger';
import db from '@/server/db';

/**
 * Gets a specific user group by id.
 * @param {string} id
 */

export default async function getUserGroup(id: string): Promise<UserGroup> {
  try {
    const result = await db.userGroup.findUniqueOrThrow({
      where: { id },
      include: {
        _count: {
          select: { userGroupMemberships: true },
        },
      },
    });

    const output: UserGroup = {
      id: result.id,
      label: result.label,
      joinCode: result.joinCode,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      memberCount: result._count.userGroupMemberships,
    };

    return output;

  } catch (error) {
    logger.error('Error getting user group', error);
    throw new Error('Error getting user group');
  }
}
