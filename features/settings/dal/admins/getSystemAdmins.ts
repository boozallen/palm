import db from '@/server/db';
import logger from '@/server/logger';
import { UserRole } from '@/features/shared/types/user';

type User = {
  id: string;
  name: string;
  email: string | null;
}

/**
 * Fetches all system admins
 */
export default async function getSystemAdmins(): Promise<User[]> {
  try {
    const users = await db.user.findMany({
      where: {
        role: UserRole.Admin,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
    }));

  } catch (error) {
    logger.error('Error fetching system admins', error);
    throw new Error('Error fetching system admins');
  }
}
