import prisma from '@/server/db';
import logger from '@/server/logger';

/**
 * Check if user has access to Context Studio based on their user group memberships
 * @param userId - User ID to check access for
 * @returns boolean indicating if user has Context Studio access
 */
export default async function getUserContextStudioAccess(userId: string): Promise<boolean> {
  try {
    // Get all user group memberships for this user
    const userGroupMemberships = await prisma.userGroupMembership.findMany({
      where: {
        userId,
      },
      include: {
        userGroup: {
          select: {
            contextStudioEnabled: true,
          },
        },
      },
    });

    // Check if any of the user's groups have Context Studio enabled
    return userGroupMemberships.some(membership =>
      membership.userGroup.contextStudioEnabled
    );

  } catch (error) {
    logger.error('Error checking user Context Studio access:', error);
    return false;
  }
}
