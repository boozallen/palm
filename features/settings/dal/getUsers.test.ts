import db from '@/server/db';
import getUsers from '@/features/settings/dal/getUsers';
import logger from '@/server/logger';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { UserRole } from '@/features/shared/types/user';
jest.mock('@/server/db', () => ({
  user: {
    findMany: jest.fn(),
  },
}));

describe('getUsers', () => {
  const mockResolveValue = [
    {
      id: '230a46ee-ab0a-4267-8a39-acd7625a4864',
      name: 'Test Name',
      email: 'name_test@domain.com',
      role: UserRole.User,
    },
    {
      id: '24b9af27-87fb-4093-b35b-105c42956bc2',
      name: 'Test Name 2',
      email: 'name2_test@domain.com',
      role: UserRole.Admin,
    },
    {
      id: 'a5256f22-4438-42d4-b395-3295d1707e9d',
      name: 'Test Name3',
      email: 'name3_test@domain.com',
      role: UserRole.User,
    },
  ];

  const mockResponseValue = [
    {
      id: '230a46ee-ab0a-4267-8a39-acd7625a4864',
      name: 'Test Name',
      email: 'name_test@domain.com',
      role: UserRole.User,
    },
    {
      id: '24b9af27-87fb-4093-b35b-105c42956bc2',
      name: 'Test Name 2',
      email: 'name2_test@domain.com',
      role: UserRole.Admin,
    },
    {
      id: 'a5256f22-4438-42d4-b395-3295d1707e9d',
      name: 'Test Name3',
      email: 'name3_test@domain.com',
      role: UserRole.User,
    },
  ];

  const mockSearchQuery = 'test';
  const mockError = 'Error getting users';
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get users from the database', async () => {
    (db.user.findMany as jest.Mock).mockResolvedValue(mockResolveValue);

    const response = await getUsers(mockSearchQuery);
    expect(response).toEqual(mockResponseValue);

    expect(db.user.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            OR: [
              { id: { equals: undefined } },
              { name: { contains: mockSearchQuery, mode: 'insensitive' } },
              { email: { contains: mockSearchQuery, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: { id: true, name: true, email: true, role: true },
      take: 10,
    });
  });
  expect(logger.error).not.toHaveBeenCalled();

  it('should throw an error if findMany fails', async () => {
    const operationError = new Error('Error getting users');

    (db.user.findMany as jest.Mock).mockRejectedValue(operationError);

    await expect(getUsers(mockSearchQuery)).rejects.toThrow(
      mockError
    );
    expect(logger.error).toHaveBeenCalledWith(mockError, operationError);
  });

  it('should throw an error if there are no records found', async () => {
    const mockNotFoundError = new PrismaClientKnownRequestError(
      'Users not found',
      { code: 'P2025', clientVersion: '5.5.2' }
    );
    (db.user.findMany as jest.Mock).mockRejectedValue(mockNotFoundError);

    await expect(getUsers(mockSearchQuery)).rejects.toThrow(
      mockError
    );
    expect(logger.error).toHaveBeenCalledWith(mockError, mockNotFoundError);
  });
});
