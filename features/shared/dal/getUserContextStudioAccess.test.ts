import getUserContextStudioAccess from './getUserContextStudioAccess';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => {
  return {
    userGroupMembership: {
      findMany: jest.fn(),
    },
  };
});

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

describe('getUserContextStudioAccess', () => {
  const userId = 'f6201669-0bef-4411-b264-cd39cfbc62df';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when user belongs to a group with Context Studio enabled', async () => {
    const mockMemberships = [
      {
        userId,
        userGroup: {
          contextStudioEnabled: true,
        },
      },
    ];

    (db.userGroupMembership.findMany as jest.Mock).mockResolvedValue(mockMemberships);

    const result = await getUserContextStudioAccess(userId);

    expect(result).toBe(true);
    expect(db.userGroupMembership.findMany).toHaveBeenCalledWith({
      where: {
        userId,
      },
      include: {
        userGroup: {
          select: {
            contextStudioEnabled: true,
          },
        },
      },
    });
  });

  it('returns true when user belongs to multiple groups and at least one has Context Studio enabled', async () => {
    const mockMemberships = [
      {
        userId,
        userGroup: {
          contextStudioEnabled: false,
        },
      },
      {
        userId,
        userGroup: {
          contextStudioEnabled: true,
        },
      },
      {
        userId,
        userGroup: {
          contextStudioEnabled: false,
        },
      },
    ];

    (db.userGroupMembership.findMany as jest.Mock).mockResolvedValue(mockMemberships);

    const result = await getUserContextStudioAccess(userId);

    expect(result).toBe(true);
  });

  it('returns false when user belongs to groups but none have Context Studio enabled', async () => {
    const mockMemberships = [
      {
        userId,
        userGroup: {
          contextStudioEnabled: false,
        },
      },
      {
        userId,
        userGroup: {
          contextStudioEnabled: false,
        },
      },
    ];

    (db.userGroupMembership.findMany as jest.Mock).mockResolvedValue(mockMemberships);

    const result = await getUserContextStudioAccess(userId);

    expect(result).toBe(false);
  });

  it('returns false when user has no group memberships', async () => {
    (db.userGroupMembership.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getUserContextStudioAccess(userId);

    expect(result).toBe(false);
  });

  it('returns false and logs error when DB query fails', async () => {
    const mockError = new Error('Database connection failed');

    (db.userGroupMembership.findMany as jest.Mock).mockRejectedValue(mockError);

    const result = await getUserContextStudioAccess(userId);

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith('Error checking user Context Studio access:', mockError);
  });
});
