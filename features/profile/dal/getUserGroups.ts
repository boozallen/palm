import z from 'zod';
import db from '@/server/db';
import { UserGroupRole } from '@/features/shared/types/user-group';
import logger from '@/server/logger';

export default async function getUserGroups(userId: string): Promise<{ id: string, label: string, role: UserGroupRole }[]> {
  try {
    const results = await db.userGroupMembership.findMany({
      include: { userGroup: true },
      where: { userId },
    });
    return results.map(result => ({
      id: result.userGroup.id,
      label: result.userGroup.label,
      role: z.nativeEnum(UserGroupRole).parse(result.role),
    }));
  } catch (error) {
    logger.error('Error getting user group memberships', error);
    throw new Error('Error getting user group memberships');
  }
}

