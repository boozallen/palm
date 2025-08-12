
import updateUserLoginAtRecord from './updateUserLoginAtRecord';
import db from '@/server/db';
import logger from '@/server/logger';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

jest.mock('@/server/db', () => ({
  user: {
    update: jest.fn(),
  },
}));

jest.mock('@/features/shared/errors/prismaErrors');

describe('updateUserLoginAtRecord DAL', () => {

  const mockUserId = 'aa356d1f-dd68-4f6b-82a9-ec9220973857';
  const mockLoggerError = 'Error updating user last login date information';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update user login at record', async () => {
    await updateUserLoginAtRecord(mockUserId);

    expect(db.user.update).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
    expect(handlePrismaError).not.toHaveBeenCalled();
  });

  it('throws an error with a sanitized Prisma error message if user update query fails', async () => {
    const sanitizedPrismaError = 'Database query error';
    const mockPrismaError = new PrismaClientKnownRequestError(
      'Database error',
      {
        code: 'P1016',
        clientVersion: '4.0.0',
      }
    );

    (db.user.update as jest.Mock).mockRejectedValueOnce(mockPrismaError);
    (handlePrismaError as jest.Mock).mockReturnValueOnce(sanitizedPrismaError);

    await expect(updateUserLoginAtRecord(mockUserId)).rejects.toThrow(sanitizedPrismaError);

    expect(db.user.update).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(mockLoggerError, mockPrismaError);
    expect(handlePrismaError).toHaveBeenCalledWith(mockPrismaError);
  });

});
