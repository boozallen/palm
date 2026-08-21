import prisma from '@/server/db';
import logger from '@/server/logger';

/**
 * Check if user has access to workflows features based on their user group memberships
 * @param userId - User ID to check access for
 * @returns boolean indicating if user has workflows access
 */
export default async function getUserWorkflowsAccess(userId: string): Promise<boolean> {
  try {
    // Get all user group memberships for this user
    const userGroupMemberships = await prisma.userGroupMembership.findMany({
      where: {
        userId,
      },
      include: {
        userGroup: {
          select: {
            workflowsEnabled: true,
          },
        },
      },
    });

    // Check if any of the user's groups have workflows enabled
    return userGroupMemberships.some(membership => 
      membership.userGroup.workflowsEnabled
    );

  } catch (error) {
    logger.error('Error checking user workflows access:', error);
    return false;
  }
}