import db from '@/server/db';
import logger from '@/server/logger';
import deleteUserGroup from './deleteUserGroup';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

jest.mock('@/server/db', () => ({
  userGroup: {
    delete: jest.fn(),
  },
}));

jest.mock('@/features/shared/errors/prismaErrors');

describe('deleteUserGroup DAL', () => {

  const userGroupId = 'd8283f19-fc06-40d2-ab82-52f7f02f2025';
  const mockLoggerError = 'Error deleting user group';

  const mockResolve = {
    id: userGroupId,
    label: 'Test User Group',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes a user group successfully', async () => {
    (db.userGroup.delete as jest.Mock).mockResolvedValue(mockResolve);

    const result = await deleteUserGroup(userGroupId);
    expect(result).toEqual({ id: userGroupId });

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

    (db.userGroup.delete as jest.Mock).mockRejectedValue(mockPrismaError);
    (handlePrismaError as jest.Mock).mockReturnValue(sanitizedPrismaError);

    await expect(deleteUserGroup(userGroupId)).rejects.toThrow(sanitizedPrismaError);

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

    (db.userGroup.delete as jest.Mock).mockRejectedValue(mockUnknownPrismaError);
    (handlePrismaError as jest.Mock).mockReturnValue(sanitizedPrismaError);

    await expect(deleteUserGroup(userGroupId)).rejects.toThrow(sanitizedPrismaError);

    expect(logger.error).toHaveBeenCalledWith(mockLoggerError, mockUnknownPrismaError);
    expect(handlePrismaError).toHaveBeenCalledWith(mockUnknownPrismaError);
  });

});
