import prisma from '@/server/db';
import logger from '@/server/logger';
import getUserGraphDatabaseAccess from './getUserGraphDatabaseAccess';

jest.mock('@/server/db', () => ({
  userGroupMembership: {
    findMany: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

describe('getUserGraphDatabaseAccess', () => {
  const mockUserId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return true when user has access to graph database through any group', async () => {
    const mockMemberships = [
      {
        userId: mockUserId,
        userGroup: {
          graphDatabaseEnabled: true,
        },
      },
      {
        userId: mockUserId,
        userGroup: {
          graphDatabaseEnabled: false,
        },
      },
    ];

    (prisma.userGroupMembership.findMany as jest.Mock).mockResolvedValue(mockMemberships);

    const result = await getUserGraphDatabaseAccess(mockUserId);

    expect(result).toBe(true);
    expect(prisma.userGroupMembership.findMany).toHaveBeenCalledWith({
      where: {
        userId: mockUserId,
      },
      include: {
        userGroup: {
          select: {
            graphDatabaseEnabled: true,
          },
        },
      },
    });
  });

  it('should return false when user has no groups with graph database access', async () => {
    const mockMemberships = [
      {
        userId: mockUserId,
        userGroup: {
          graphDatabaseEnabled: false,
        },
      },
      {
        userId: mockUserId,
        userGroup: {
          graphDatabaseEnabled: false,
        },
      },
    ];

    (prisma.userGroupMembership.findMany as jest.Mock).mockResolvedValue(mockMemberships);

    const result = await getUserGraphDatabaseAccess(mockUserId);

    expect(result).toBe(false);
  });

  it('should return false when user has no group memberships', async () => {
    (prisma.userGroupMembership.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getUserGraphDatabaseAccess(mockUserId);

    expect(result).toBe(false);
  });

  it('should return false and log error when database query fails', async () => {
    const mockError = new Error('Database connection failed');
    (prisma.userGroupMembership.findMany as jest.Mock).mockRejectedValue(mockError);

    const result = await getUserGraphDatabaseAccess(mockUserId);

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith('Error checking user graph database access:', mockError);
  });

  it('should return true when at least one group has graph database enabled', async () => {
    const mockMemberships = [
      {
        userId: mockUserId,
        userGroup: {
          graphDatabaseEnabled: false,
        },
      },
      {
        userId: mockUserId,
        userGroup: {
          graphDatabaseEnabled: false,
        },
      },
      {
        userId: mockUserId,
        userGroup: {
          graphDatabaseEnabled: true,
        },
      },
    ];

    (prisma.userGroupMembership.findMany as jest.Mock).mockResolvedValue(mockMemberships);

    const result = await getUserGraphDatabaseAccess(mockUserId);

    expect(result).toBe(true);
  });
});