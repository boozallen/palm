import { UserRole } from '@/features/shared/types/user';
import db from '@/server/db';
import updateUserRole from './updateUserRole';
import logger from '@/server/logger';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

jest.mock('@/server/db', () => ({
  user: {
    update: jest.fn(),
  },
}));

jest.mock('@/features/shared/errors/prismaErrors');

describe('updateUserRole', () => {
  const mockUserId = 'aa356d1f-dd68-4f6b-82a9-ec9220973857';
  const mockLoggerError = 'Error updating user role';
  const resolvedValue = {
    id: mockUserId,
    name: 'John Doe',
    email: 'doe_john@domain.com',
    role: UserRole.Admin,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update the user system role', async () => {
    (db.user.update as jest.Mock).mockResolvedValue(resolvedValue);

    await expect(updateUserRole(mockUserId, UserRole.Admin)).resolves.toEqual(resolvedValue);

    expect(db.user.update).toHaveBeenCalledWith({
      where: {
        id: mockUserId,
      },
      data: {
        role: UserRole.Admin,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });
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

    (db.user.update as jest.Mock).mockRejectedValue(mockPrismaError);
    (handlePrismaError as jest.Mock).mockReturnValue(sanitizedPrismaError);

    await expect(updateUserRole(mockUserId, UserRole.Admin)).rejects.toThrow(sanitizedPrismaError);

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

    (db.user.update as jest.Mock).mockRejectedValue(mockUnknownPrismaError);
    (handlePrismaError as jest.Mock).mockReturnValue(sanitizedPrismaError);

    await expect(updateUserRole(mockUserId, UserRole.Admin)).rejects.toThrow(sanitizedPrismaError);

    expect(logger.error).toHaveBeenCalledWith(mockLoggerError, mockUnknownPrismaError);
    expect(handlePrismaError).toHaveBeenCalledWith(mockUnknownPrismaError);
  });

});
