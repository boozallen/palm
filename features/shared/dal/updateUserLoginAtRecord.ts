import db from '@/server/db';
import logger from '@/server/logger';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

/**
 * Updates user last login at record
 * @param {string} userId
 * @returns {Promise<void>}
 */
export default async function updateUserLoginAtRecord(userId: string): Promise<void> {
  try {
    await db.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error updating user last login date information', error);
    throw new Error(handlePrismaError(error));
  }
}
