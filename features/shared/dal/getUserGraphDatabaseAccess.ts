import prisma from '@/server/db';
import logger from '@/server/logger';

/**
 * Check if user has access to graph database features based on their user group memberships
 * @param userId - User ID to check access for
 * @returns boolean indicating if user has graph database access
 */
export default async function getUserGraphDatabaseAccess(userId: string): Promise<boolean> {
  try {
    // Get all user group memberships for this user
    const userGroupMemberships = await prisma.userGroupMembership.findMany({
      where: {
        userId,
      },
      include: {
        userGroup: {
          select: {
            graphDatabaseEnabled: true,
          },
        },
      },
    });

    // Check if any of the user's groups have graph database enabled
    return userGroupMemberships.some(membership => 
      membership.userGroup.graphDatabaseEnabled
    );

  } catch (error) {
    logger.error('Error checking user graph database access:', error);
    return false;
  }
}