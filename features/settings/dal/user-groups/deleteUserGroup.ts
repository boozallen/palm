import db from '@/server/db';
import logger from '@/server/logger';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

/**
 * Deletes a specific user group by id.
 * @param {string} id
 */
export default async function deleteUserGroup(id: string):
  Promise<{ id: string }> {

  try {
    const deletedUserGroup = await db.userGroup.delete({
      where: { id: id },
    });

    return { id: deletedUserGroup.id };

  } catch (error) {
    logger.error('Error deleting user group', error);
    throw new Error(handlePrismaError(error));
  }
};
