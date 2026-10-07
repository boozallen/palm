import db from '@/server/db';
import logger from '@/server/logger';

export default async function isUserGroupMember(userId: string, userGroupId: string): Promise<boolean> {
  try {
    const membership = await db.userGroupMembership.findUnique({
      where: { userGroupId_userId: { userGroupId, userId } },
    });
    return membership !== null;
  } catch (error) {
    logger.error(`Error checking user group membership: UserId: ${userId}, UserGroupId: ${userGroupId}`, error);
    throw new Error('Error checking user group membership');
  }
}
