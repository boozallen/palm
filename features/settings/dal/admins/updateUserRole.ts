import { UserRole } from '@/features/shared/types/user';
import db from '@/server/db';
import logger from '@/server/logger';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

type User = {
  id: string,
  name: string,
  email: string | null,
  role: UserRole,
}

/**
 * Function to update the user system role
 * @param id Unique identifier of the user
 * @param role User's new role
 */
export default async function updateUserRole(id: string, role: UserRole): Promise<User> {
  try {
    const user = await db.user.update({
      where: {
        id,
      },
      data: {
        role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
    };
  } catch (error) {
    logger.error('Error updating user role', error);
    throw new Error(handlePrismaError(error));
  }
}
