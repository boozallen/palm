import db from '@/server/db';
import logger from '@/server/logger';
import { UserGroupRole, UserGroupMembership } from '@/features/shared/types/user-group';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

export default async function createUserGroupMembership(userGroupId: string, userId: string, role: UserGroupRole):
  Promise<UserGroupMembership> {
  try {
    // Check if the user is already a member of the group
    const existingMembership = await db.userGroupMembership.findFirst({
      where: {
        userGroupId: userGroupId,
        userId: userId,
      },
    });

    if (existingMembership) {
      throw new Error('User already assigned to this group');
    }

    const user = await db.user.findUniqueOrThrow({
      where: {
        id: userId,
      },
      select: {
        name: true,
        email: true,
      },
    });

    const userGroupMembership = await db.userGroupMembership.create({
      data: {
        userGroupId: userGroupId,
        userId: userId,
        role: role,
      },
    });

    return {
      userGroupId: userGroupMembership.userGroupId,
      userId: userGroupMembership.userId,
      name: user.name,
      role: userGroupMembership.role as UserGroupRole,
      email: user.email,
    };

  } catch (error) {
    logger.error('Error creating user group membership', error);
    throw new Error(handlePrismaError(error));
  }
}
