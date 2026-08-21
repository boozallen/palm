import db from '@/server/db';
import logger from '@/server/logger';
import { UserGroupRole } from '@/features/shared/types/user-group';

export default async function getIsUserGroupLead(userId: string): Promise<boolean> {
  try {
    const userGroupMembershipLeadCount = await db.userGroupMembership.count({
      where: {
        userId,
        role: {
          equals: UserGroupRole.Lead,
        },
      },
    });

    return userGroupMembershipLeadCount > 0;

  } catch (error) {
    logger.error('Error getting user group lead status', error);
    throw new Error('Error getting user group lead status');
  }
}
