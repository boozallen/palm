import db from '@/server/db';
import logger from '@/server/logger';
import getUserWorkflowsAccess from './getUserWorkflowsAccess';

jest.mock('@/server/db', () => ({
  userGroupMembership: {
    findMany: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

describe('getUserWorkflowsAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return true when user has access to workflows through at least one group', async () => {
    const mockMemberships = [
      {
        userGroup: {
          workflowsEnabled: false,
        },
      },
      {
        userGroup: {
          workflowsEnabled: true,
        },
      },
    ];

    (db.userGroupMembership.findMany as jest.Mock).mockResolvedValue(mockMemberships);

    const result = await getUserWorkflowsAccess('testUserId');

    expect(result).toBe(true);
    expect(db.userGroupMembership.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'testUserId',
      },
      include: {
        userGroup: {
          select: {
            workflowsEnabled: true,
          },
        },
      },
    });
  });

  it('should return false when user has no groups with workflows enabled', async () => {
    const mockMemberships = [
      {
        userGroup: {
          workflowsEnabled: false,
        },
      },
      {
        userGroup: {
          workflowsEnabled: false,
        },
      },
    ];

    (db.userGroupMembership.findMany as jest.Mock).mockResolvedValue(mockMemberships);

    const result = await getUserWorkflowsAccess('testUserId');

    expect(result).toBe(false);
  });

  it('should return false when user has no group memberships', async () => {
    (db.userGroupMembership.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getUserWorkflowsAccess('testUserId');

    expect(result).toBe(false);
  });

  it('should return true when all user groups have workflows enabled', async () => {
    const mockMemberships = [
      {
        userGroup: {
          workflowsEnabled: true,
        },
      },
      {
        userGroup: {
          workflowsEnabled: true,
        },
      },
    ];

    (db.userGroupMembership.findMany as jest.Mock).mockResolvedValue(mockMemberships);

    const result = await getUserWorkflowsAccess('testUserId');

    expect(result).toBe(true);
  });

  it('should return false and log error when database query fails', async () => {
    const mockError = new Error('Database connection failed');
    (db.userGroupMembership.findMany as jest.Mock).mockRejectedValue(mockError);

    const result = await getUserWorkflowsAccess('testUserId');

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith('Error checking user workflows access:', mockError);
  });
});