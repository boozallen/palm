import { UserGroup } from '@/features/shared/types/user-group';
import db from '@/server/db';
import logger from '@/server/logger';

export default async function getUserGroups(): Promise<UserGroup[]> {
  try {
    const results = await db.userGroup.findMany({
      include: {
        _count: {
          select: { userGroupMemberships: true },
        },
      },
    });

    return results.map(
      (userGroup): UserGroup => ({
        id: userGroup.id,
        label: userGroup.label,
        createdAt: userGroup.createdAt,
        updatedAt: userGroup.updatedAt,
        memberCount: userGroup._count?.userGroupMemberships ?? 0,
      })
    );
  } catch (error) {
    logger.error('Error getting user groups', error);
    throw new Error('Error getting user groups');
  }
}
