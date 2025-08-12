import { UserGroup } from '@/features/shared/types/user-group';
import db from '@/server/db';
import logger from '@/server/logger';

export async function getUserGroupByJoinCode(joinCode: string): Promise<UserGroup | null> {
  let group;
  try {
    group = await db.userGroup.findUnique({
      where: {
        joinCode,
      },
      include: {
        _count: {
          select: { userGroupMemberships: true },
        },
      },
    });
  } catch (error) {
    logger.error('Error finding user group by join code', error);
    throw new Error('Error finding user group by join code');
  }

  if (group) {
    return {
      id: group.id,
      label: group.label,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      memberCount: group._count?.userGroupMemberships ?? 0,
    };
  } else {
    return null;
  }
}
