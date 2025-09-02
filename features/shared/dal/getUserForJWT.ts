import db from '@/server/db';
import logger from '@/server/logger';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';

export type UserForJWT = {
  role: UserRole,
  isUserGroupLead: boolean,
  lastLoginAt: Date | null,
}

/**
 * Gets user data necessary for the JWT
 * @param {string} userId
 * @returns {Promise<UserForJWT | null>}
 */
export default async function getUserForJWT(userId: string): Promise<UserForJWT | null> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        _count: {
          select: {
            userGroupMemberhip: {
              where: {
                role: { equals: UserGroupRole.Lead },
              },
            },
          },
        },
        lastLoginAt: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      role: user.role as UserRole,
      isUserGroupLead: !!user._count.userGroupMemberhip,
      lastLoginAt: user.lastLoginAt,
    };
  } catch (error) {
    logger.error('Error getting user for JWT', error);
    throw new Error('Error getting user for JWT');
  }
}
