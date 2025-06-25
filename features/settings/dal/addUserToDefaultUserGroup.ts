import db from '@/server/db';
import logger from '@/server/logger';
import { UserRole } from '@/features/shared/types/user';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

/**
 * Adds a user to the default user group
 * @param userId The user's ID to add
 */
export default async function addUserToDefaultUserGroup(userId: string): Promise<void> {
  try {
    const systemConfig = await db.systemConfig.findFirst({
      where: {
        defaultUserGroupId: {
          not: null,
        },
      },
      select: {
        defaultUserGroupId: true,
      },
    });

    if (systemConfig?.defaultUserGroupId) {
      await db.userGroupMembership.upsert({
        where: {
          userGroupId_userId: {
            userId,
            userGroupId: systemConfig.defaultUserGroupId,
          },
        },
        create: {
          userId,
          userGroupId: systemConfig.defaultUserGroupId,
          role: UserRole.User,
        },
        update: {},
      });
    } else {
      throw new Error('No default user group ID found');
    }
  } catch (error) {
    logger.error('Error adding user to default user group', error);
    if ((error as Error).message === 'No default user group ID found') {
      throw error;
    }
    throw new Error(handlePrismaError(error));
  }
};
