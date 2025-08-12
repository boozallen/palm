import db from '@/server/db';
import logger from '@/server/logger';
import deleteUserGroupMembership from './deleteUserGroupMembership';
import { UserGroupRole, UserGroupMembership } from '@/features/shared/types/user-group';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

jest.mock('@/server/db', () => ({
  userGroupMembership: {
    delete: jest.fn(),
  },
}));

jest.mock('@/features/shared/errors/prismaErrors');

describe('deleteUserGroupMembership DAL', () => {

  const mockUserGroupId = 'd8283f19-fc06-40d2-ab82-52f7f02f2025';
  const mockUserId = 'b5df35d9-c8a9-4b8d-b904-87e197f4b1ef';
  const mockLoggerError = 'Error deleting user group membership';

  const mockDeleteResolve = {
    user: {
      name: 'Doe, John',
      email: 'doe_john@domain.com',
    },
    userGroupId: mockUserGroupId,
    userId: mockUserId,
    role: UserGroupRole.User,
  };
  const mockResponse: UserGroupMembership = {
    userGroupId: mockUserGroupId,
    userId: mockUserId,
    name: 'Doe, John',
    role: UserGroupRole.User,
    email: 'doe_john@domain.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes a user group membership', async () => {
    (db.userGroupMembership.delete as jest.Mock).mockResolvedValue(mockDeleteResolve);

    const response = await deleteUserGroupMembership(mockUserGroupId, mockUserId);
    expect(response).toEqual(mockResponse);

    expect(db.userGroupMembership.delete).toHaveBeenCalledWith({
      where: {
        userGroupId_userId: {
          userGroupId: mockUserGroupId,
          userId: mockUserId,
        },
      },
      include: { user: true },
    });

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws an error with a sanitized Prisma error message if query fails with Prisma code: P2015', async () => {
    const sanitizedPrismaError = 'Required record not found';
    const mockPrismaError = new PrismaClientKnownRequestError(
      'A related record could not be found',
      {
        code: 'P2015',
        clientVersion: '4.0.0',
      }
    );

    (db.userGroupMembership.delete as jest.Mock).mockRejectedValue(mockPrismaError);
    (handlePrismaError as jest.Mock).mockReturnValue(sanitizedPrismaError);

    await expect(deleteUserGroupMembership(mockUserGroupId, mockUserId)).rejects.toThrow(sanitizedPrismaError);

    expect(logger.error).toHaveBeenCalledWith(mockLoggerError, mockPrismaError);
    expect(handlePrismaError).toHaveBeenCalledWith(mockPrismaError);
  });

  it('throws a generic error for an unknown Prisma error', async () => {
    const sanitizedPrismaError = 'An unexpected database error occurred';
    const mockUnknownPrismaError = new PrismaClientKnownRequestError(
      'Unknown error',
      {
        code: 'P9999',
        clientVersion: '4.0.0',
      }
    );

    (db.userGroupMembership.delete as jest.Mock).mockRejectedValue(mockUnknownPrismaError);
    (handlePrismaError as jest.Mock).mockReturnValue(sanitizedPrismaError);

    await expect(deleteUserGroupMembership(mockUserGroupId, mockUserId)).rejects.toThrow(sanitizedPrismaError);

    expect(logger.error).toHaveBeenCalledWith(mockLoggerError, mockUnknownPrismaError);
    expect(handlePrismaError).toHaveBeenCalledWith(mockUnknownPrismaError);
  });

});
