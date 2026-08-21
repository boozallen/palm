import prisma from '@/server/db';
import logger from '@/server/logger';

/**
 * Check if user has access to agentic chat based on their user group memberships
 * @param userId - User ID to check access for
 * @returns boolean indicating if user has agentic chat access
 */
export default async function getUserAgenticChatAccess(userId: string): Promise<boolean> {
  try {
    const userGroupMemberships = await prisma.userGroupMembership.findMany({
      where: {
        userId,
      },
      include: {
        userGroup: {
          select: {
            agenticChatEnabled: true,
          },
        },
      },
    });

    return userGroupMemberships.some(
      (membership) => membership.userGroup.agenticChatEnabled,
    );
  } catch (error) {
    logger.error('Error checking user agentic chat access:', error);
    return false;
  }
}
