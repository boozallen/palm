import db from '@/server/db';
import logger from '@/server/logger';
import createUserGroupMembership from './createUserGroupMembership';
import {
  UserGroupRole,
  UserGroupMembership,
} from '@/features/shared/types/user-group';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

jest.mock('@/server/db', () => ({
  user: {
    findUniqueOrThrow: jest.fn(),
  },
  userGroupMembership: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('@/features/shared/errors/prismaErrors');

describe('createUserGroupMembership DAL', () => {
  const mockUserGroupId = 'd8283f19-fc06-40d2-ab82-52f7f02f2025';
  const mockUserId = 'b5df35d9-c8a9-4b8d-b904-87e197f4b1ef';
  const mockLoggerError = 'Error creating user group membership';

  const mockFindUniqueOrThrowResolve = {
    name: 'Doe, John',
    email: 'doe_john@domain.com',
  };
  const mockCreateResolve = {
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

  it('creates a user group membership', async () => {
    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue(null);
    (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(
      mockFindUniqueOrThrowResolve
    );
    (db.userGroupMembership.create as jest.Mock).mockResolvedValue(
      mockCreateResolve
    );

    const response = await createUserGroupMembership(
      mockUserGroupId,
      mockUserId,
      UserGroupRole.User
    );
    expect(response).toEqual(mockResponse);

    expect(db.userGroupMembership.findFirst).toHaveBeenCalledWith({
      where: {
        userGroupId: mockUserGroupId,
        userId: mockUserId,
      },
    });
    expect(db.user.findUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        id: mockUserId,
      },
      select: {
        name: true,
        email: true,
      },
    });
    expect(db.userGroupMembership.create).toHaveBeenCalledWith({
      data: {
        userGroupId: mockUserGroupId,
        userId: mockUserId,
        role: UserGroupRole.User,
      },
    });

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws an error if the user is already a member of the group', async () => {
    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue({
      userGroupId: mockUserGroupId,
      userId: mockUserId,
    });
    (handlePrismaError as jest.Mock).mockReturnValue(
      'User already assigned to this group'
    );

    await expect(
      createUserGroupMembership(mockUserGroupId, mockUserId, UserGroupRole.User)
    ).rejects.toThrow('User already assigned to this group');

    expect(db.userGroupMembership.findFirst).toHaveBeenCalledWith({
      where: {
        userGroupId: mockUserGroupId,
        userId: mockUserId,
      },
    });
    expect(db.userGroupMembership.create).not.toHaveBeenCalled();
  });

  it('throws an error if the user does not exist', async () => {
    const mockUserGroupId = 'group1';
    const mockUserId = 'nonexistent-user';
    const mockError = new PrismaClientKnownRequestError(
      'Foreign key constraint failed on the field: `userId`',
      {
        code: 'P2003',
        clientVersion: '4.0.0',
      }
    );

    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue(null);
    (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      name: 'Test User',
      email: 'test@example.com',
    });
    (db.userGroupMembership.create as jest.Mock).mockRejectedValue(mockError);
    (handlePrismaError as jest.Mock).mockReturnValue(
      'Foreign key constraint violation'
    );

    await expect(
      createUserGroupMembership(mockUserGroupId, mockUserId, UserGroupRole.User)
    ).rejects.toThrow('Foreign key constraint violation');

    expect(db.userGroupMembership.findFirst).toHaveBeenCalledWith({
      where: {
        userGroupId: mockUserGroupId,
        userId: mockUserId,
      },
    });
    expect(db.user.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: mockUserId },
      select: { name: true, email: true },
    });
    expect(db.userGroupMembership.create).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'Error creating user group membership',
      mockError
    );
    expect(handlePrismaError).toHaveBeenCalledWith(mockError);
  });

  it('throws Error with sanitized Prisma error message for unique constraint violation', async () => {
    const sanitizedPrismaError = 'Unique constraint violation';
    const mockPrismaError = new PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '4.0.0',
      }
    );

    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue(null);
    (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(
      mockFindUniqueOrThrowResolve
    );

    (db.userGroupMembership.create as jest.Mock).mockRejectedValue(
      mockPrismaError
    );

    (handlePrismaError as jest.Mock).mockReturnValue(sanitizedPrismaError);

    await expect(
      createUserGroupMembership(mockUserGroupId, mockUserId, UserGroupRole.User)
    ).rejects.toThrow(sanitizedPrismaError);

    expect(logger.error).toHaveBeenCalledWith(
      'Error creating user group membership',
      mockPrismaError
    );

    expect(handlePrismaError).toHaveBeenCalledWith(mockPrismaError);
  });

  it('throws generic error for unknown Prisma error', async () => {
    const sanitizedPrismaError = 'An unexpected database error occurred';
    const mockUnknownPrismaError = new PrismaClientKnownRequestError(
      'Unknown error',
      {
        code: 'P9999',
        clientVersion: '4.0.0',
      }
    );

    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue(null);
    (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(
      mockFindUniqueOrThrowResolve
    );
    (db.userGroupMembership.create as jest.Mock).mockRejectedValue(
      mockUnknownPrismaError
    );

    (handlePrismaError as jest.Mock).mockReturnValue(sanitizedPrismaError);

    await expect(
      createUserGroupMembership(mockUserGroupId, mockUserId, UserGroupRole.User)
    ).rejects.toThrow(sanitizedPrismaError);

    expect(logger.error).toHaveBeenCalledWith(
      mockLoggerError,
      mockUnknownPrismaError
    );

    expect(handlePrismaError).toHaveBeenCalledWith(mockUnknownPrismaError);
  });
});
