import db from '@/server/db';
import { UserGroup } from '@/features/shared/types/user-group';
import logger from '@/server/logger';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

type CreateUserGroupInput = {
  label: string;
};

/**
 * Creates a new user group
 * @param input - The user group to create
 * @returns The created user group
 */
export default async function createUserGroup(
  input: CreateUserGroupInput
): Promise<UserGroup> {

  let existingUserGroup = undefined;
  try {
    existingUserGroup = await db.userGroup.findFirst({
      where: {
        label: {
          equals: input.label,
          mode: 'insensitive',
        },
      },
    });

  } catch (error) {
    logger.error('Error creating user group', error);
    throw new Error(handlePrismaError(error));
  }

  if (existingUserGroup) {
    throw new Error('A user group with that name already exists');
  }

  try {
    const response = await db.userGroup.create({
      data: {
        label: input.label,
      },
    });

    return {
      id: response.id,
      label: response.label,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
      memberCount: 0,
    };
  } catch (error) {
    logger.error('Error creating user group', error);
    throw new Error(handlePrismaError(error));
  }
}
