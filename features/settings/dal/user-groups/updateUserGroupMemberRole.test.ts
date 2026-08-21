import db from '@/server/db';
import logger from '@/server/logger';
import updateUserGroupMemberRole from './updateUserGroupMemberRole';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

jest.mock('@/server/db', () => ({
  userGroupMembership: {
    update: jest.fn().mockResolvedValue({
      role: 'Lead',
      userGroupId: '1',
      userId: '2',
    }),
  },
}));

jest.mock('@/features/shared/errors/prismaErrors');

describe('updateUserGroupMemberRole', () => {
  it('updates the user group members role successfully', async () => {
    (db.userGroupMembership.update as jest.Mock).mockResolvedValue({
      role: UserGroupRole.Lead,
      userGroupId: '1',
      userId: '2',
    });
    const input = {
      userGroupId: '1',
      userId: '2',
      role: UserGroupRole.Lead,
    };
    const response = await updateUserGroupMemberRole(input);
    expect(db.userGroupMembership.update).toHaveBeenCalledWith({
      where: {
        userGroupId_userId: {
          userGroupId: input.userGroupId,
          userId: input.userId,
        },
      },
      data: {
        role: input.role,
      },
    });
    expect(response).toEqual({
      role: UserGroupRole.Lead,
      userGroupId: '1',
      userId: '2',
    });
  });

  it('throws Error with sanitized Prisma error message for unique constraint violation', async () => {
    const input = {
      userGroupId: '1',
      userId: '2',
      role: UserGroupRole.Lead,
    };

    const mockPrismaError = new PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '4.0.0',
      }
    );

    (db.userGroupMembership.update as jest.Mock).mockRejectedValue(
      mockPrismaError
    );

    (handlePrismaError as jest.Mock).mockReturnValue(
      'Unique constraint violation'
    );

    await expect(updateUserGroupMemberRole(input)).rejects.toThrow(
      'Unique constraint violation'
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Error updating user group member role',
      mockPrismaError
    );

    expect(handlePrismaError).toHaveBeenCalledWith(mockPrismaError);
  });
});

it('throws generic Error for unknown Prisma error', async () => {
  const input = {
    userGroupId: '1',
    userId: '2',
    role: UserGroupRole.Lead,
  };

  const mockUnknownPrismaError = new PrismaClientKnownRequestError(
    'Unknown error',
    {
      code: 'P9999',
      clientVersion: '4.0.0',
    }
  );

  (db.userGroupMembership.update as jest.Mock).mockRejectedValue(
    mockUnknownPrismaError
  );

  (handlePrismaError as jest.Mock).mockReturnValue(
    'An unexpected database error occurred'
  );

  await expect(updateUserGroupMemberRole(input)).rejects.toThrow(
    'An unexpected database error occurred'
  );

  expect(logger.error).toHaveBeenCalledWith(
    'Error updating user group member role',
    mockUnknownPrismaError
  );

  expect(handlePrismaError).toHaveBeenCalledWith(mockUnknownPrismaError);
});
