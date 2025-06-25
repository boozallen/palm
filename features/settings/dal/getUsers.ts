import { UserRole } from '@/features/shared/types/user';
import db from '@/server/db';
import logger from '@/server/logger';

type User = {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
};

/**
 * Gets a list of users based on search query and userId
 * @param {string} searchQuery
 * @param {string} userId - Optional
 */

export default async function getUsers(searchQuery: string, userId?: string, limit: number = 10): Promise<User[]> {
  try {
    const users = await db.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { id: { equals: userId } },
              { name: { contains: searchQuery, mode: 'insensitive' } },
              { email: { contains: searchQuery, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: { id: true, name: true, email: true, role: true },
      take: limit,
    });

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
    }));

  } catch (error) {
    logger.error('Error getting users', error);
    throw new Error('Error getting users');
  }
}
