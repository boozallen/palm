import db from '@/server/db';
import getUser from '@/features/settings/dal/shared/getUser';
import logger from '@/server/logger';
import { UserRole } from '@/features/shared/types/user';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

jest.mock('@/server/db', () => ({
  user: {
    findUnique: jest.fn(),
  },
}));

describe('getUser', () => {
  const mockUserId = '230a46ee-ab0a-4267-8a39-acd7625a4864';
  const mockUser = {
    id: mockUserId,
    name: 'Test Name',
    email: 'name_test@domain.com',
    role: UserRole.User,
  };

  const mockError = 'Error getting user';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get a user from the database', async () => {
    (db.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    const response = await getUser(mockUserId);
    expect(response).toEqual(mockUser);

    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: mockUserId },
      select: { id: true, name: true, email: true, role: true },
    });
  });

  it('should return null if user is not found', async () => {
    (db.user.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await getUser(mockUserId);
    expect(response).toBeNull();

    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: mockUserId },
      select: { id: true, name: true, email: true, role: true },
    });
  });

  it('should throw an error if findUnique fails', async () => {
    const operationError = new Error('Error getting user');

    (db.user.findUnique as jest.Mock).mockRejectedValue(operationError);

    await expect(getUser(mockUserId)).rejects.toThrow(mockError);
    expect(logger.error).toHaveBeenCalledWith(mockError, operationError);
  });

  it('should throw an error if there is a known request error', async () => {
    const mockNotFoundError = new PrismaClientKnownRequestError(
      'User not found',
      { code: 'P2025', clientVersion: '5.5.2' }
    );
    (db.user.findUnique as jest.Mock).mockRejectedValue(mockNotFoundError);

    await expect(getUser(mockUserId)).rejects.toThrow(mockError);
    expect(logger.error).toHaveBeenCalledWith(mockError, mockNotFoundError);
  });
});
