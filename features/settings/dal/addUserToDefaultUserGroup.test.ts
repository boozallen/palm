import addUserToDefaultUserGroup from './addUserToDefaultUserGroup';
import db from '@/server/db';
import logger from '@/server/logger';
import { UserRole } from '@/features/shared/types/user';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

jest.mock('@/server/db', () => ({
  systemConfig: {
    findFirst: jest.fn(),
  },
  userGroupMembership: {
    upsert: jest.fn(),
  },
}));

jest.mock('@/features/shared/errors/prismaErrors');

describe('addUserToDefaultUserGroup DAL', () => {
  const mockUserId = 'aa356d1f-dd68-4f6b-82a9-ec9220973857';
  const mockSystemConfig = {
    defaultUserGroupId: 'b5df35d9-c8a9-4b8d-b904-87e197f4b1ef',
  };
  const mockLoggerError = 'Error adding user to default user group';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should add the user to the default user group', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue(mockSystemConfig);

    await addUserToDefaultUserGroup(mockUserId);

    expect(db.systemConfig.findFirst).toHaveBeenCalledWith({
      where: {
        defaultUserGroupId: {
          not: null,
        },
      },
      select: {
        defaultUserGroupId: true,
      },
    });

    expect(db.userGroupMembership.upsert).toHaveBeenCalledWith({
      where: {
        userGroupId_userId: {
          userId: mockUserId,
          userGroupId: mockSystemConfig.defaultUserGroupId,
        },
      },
      create: {
        userId: mockUserId,
        userGroupId: mockSystemConfig.defaultUserGroupId,
        role: UserRole.User,
      },
      update: {},
    });

    expect(logger.error).not.toHaveBeenCalled();
    expect(handlePrismaError).not.toHaveBeenCalled();
  });

  it('throws an error with a generic message if no default user group is set', async () => {
    const mockError = new Error('No default user group ID found');

    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(addUserToDefaultUserGroup(mockUserId)).rejects.toThrow(mockError);

    expect(db.userGroupMembership.upsert).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(mockLoggerError, mockError);
    expect(handlePrismaError).not.toHaveBeenCalled();
  });

  it('throws an error with a sanitized Prisma error message if systemConfig findFirst query fails', async () => {
    const sanitizedPrismaError = 'Database operation timed out';
    const mockPrismaError = new PrismaClientKnownRequestError(
      'The operation took too long',
      {
        code: 'P1008',
        clientVersion: '4.0.0',
      }
    );

    (db.systemConfig.findFirst as jest.Mock).mockRejectedValue(mockPrismaError);
    (handlePrismaError as jest.Mock).mockReturnValue(sanitizedPrismaError);

    await expect(addUserToDefaultUserGroup(mockUserId)).rejects.toThrow(sanitizedPrismaError);

    expect(db.userGroupMembership.upsert).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(mockLoggerError, mockPrismaError);
    expect(handlePrismaError).toHaveBeenCalledWith(mockPrismaError);
  });

  it('throws an error with a sanitized Prisma error message if userGroupMembership upsert query fails', async () => {
    const sanitizedPrismaError = 'Database operation timed out';
    const mockPrismaError = new PrismaClientKnownRequestError(
      'The operation took too long',
      {
        code: 'P1008',
        clientVersion: '4.0.0',
      }
    );

    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue(mockSystemConfig);
    (db.userGroupMembership.upsert as jest.Mock).mockRejectedValue(mockPrismaError);
    (handlePrismaError as jest.Mock).mockReturnValue(sanitizedPrismaError);

    await expect(addUserToDefaultUserGroup(mockUserId)).rejects.toThrow(sanitizedPrismaError);

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

    (db.systemConfig.findFirst as jest.Mock).mockRejectedValue(mockUnknownPrismaError);
    (handlePrismaError as jest.Mock).mockReturnValue(sanitizedPrismaError);

    await expect(addUserToDefaultUserGroup(mockUserId)).rejects.toThrow(sanitizedPrismaError);

    expect(logger.error).toHaveBeenCalledWith(mockLoggerError, mockUnknownPrismaError);
    expect(handlePrismaError).toHaveBeenCalledWith(mockUnknownPrismaError);
  });

});
