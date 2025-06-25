import getUserForJWT from '@/features/shared/dal/getUserForJWT';
import db from '@/server/db';
import logger from '@/server/logger';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';

jest.mock('@/server/db', () => ({
  user: {
    findUnique: jest.fn(),
  },
}));

describe('getUserForJWT DAL', () => {
  const mockUserId = '230a46ee-ab0a-4267-8a39-acd7625a4864';
  const mockResolve = {
    role: UserRole.User,
    _count: {
      userGroupMemberhip: 2,
    },
    lastLoginAt: new Date('2024-02-02T00:00:00.000Z'),
  };
  const mockError = 'Error getting user for JWT';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get necessary user data for the JWT from the database', async () => {
    (db.user.findUnique as jest.Mock).mockResolvedValue(mockResolve);

    const response = await getUserForJWT(mockUserId);
    expect(response).toEqual({
      role: mockResolve.role,
      isUserGroupLead: !!mockResolve._count.userGroupMemberhip,
      lastLoginAt: mockResolve.lastLoginAt,
    });

    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: mockUserId },
      select: {
        role: true,
        _count: {
          select: {
            userGroupMemberhip: {
              where: {
                role: { equals: UserGroupRole.Lead },
              },
            },
          },
        },
        lastLoginAt: true,
      },
    });

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should return null if user not found', async () => {
    (db.user.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await getUserForJWT(mockUserId);
    expect(response).toEqual(null);

    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: mockUserId },
      select: {
        role: true,
        _count: {
          select: {
            userGroupMemberhip: {
              where: {
                role: { equals: UserGroupRole.Lead },
              },
            },
          },
        },
        lastLoginAt: true,
      },
    });

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should throw an error if the findUnique query fails', async () => {
    const queryError = new Error('Unexpected error');
    (db.user.findUnique as jest.Mock).mockRejectedValue(queryError);

    await expect(getUserForJWT(mockUserId)).rejects.toThrow(mockError);
    expect(logger.error).toHaveBeenCalledWith(mockError, queryError);
  });

});
