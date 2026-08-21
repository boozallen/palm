import { UserRole } from '@/features/shared/types/user';
import db from '@/server/db';
import logger from '@/server/logger';
import { User } from 'next-auth';
/**
 * Gets a user based on userId
 * @param {string} userId
 * @returns {Promise<User | null>}
 */
export default async function getUser(userId: string): Promise<User | null> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
    };
  } catch (error) {
    logger.error('Error getting user', error);
    throw new Error('Error getting user');
  }
}
