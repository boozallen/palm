import { describe, expect, it, beforeEach } from '@jest/globals';
import settingsRouter from '../';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { type ContextType } from '@/server/trpc-context';
import { Forbidden } from '@/features/shared/errors/routeErrors';

// Mock the dependencies
jest.mock('@/features/settings/dal/user-groups/updateUserGroupJoinCode');
jest.mock('@/features/settings/dal/user-groups/getUserGroupMembership');

import updateUserGroupJoinCode from '@/features/settings/dal/user-groups/updateUserGroupJoinCode';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import logger from '@/server/logger';
import { TRPCError } from '@trpc/server';

describe('generateUserGroupJoinCode', () => {
  const mockUserGroupId = '12345678-1234-1234-1234-123456789012';
  const mockUserId = 'user-123';
  const mockJoinCode = 'Ab1Cd2Ef';

  const mockUserGroup = {
    id: mockUserGroupId,
    label: 'Test Group',
    joinCode: mockJoinCode,
    createdAt: new Date(),
    updatedAt: new Date(),
    memberCount: 42,
  };

  const mockContext = {
    userId: mockUserId,
    userRole: UserRole.User,
    logger: logger,
  } as unknown as ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    (updateUserGroupJoinCode as jest.Mock).mockResolvedValue(mockUserGroup);

    // Mock crypto.randomInt to return predictable values
    //const mockedRandomInt = jest.mocked(crypto.randomInt);
    let counter = 0;
  });

  it('should generate a join code for admin users without checking membership', async () => {
    (updateUserGroupJoinCode as jest.Mock).mockResolvedValueOnce(mockUserGroup);

    const adminContext = {
      ...mockContext,
      userRole: UserRole.Admin,
    };

    const caller = settingsRouter.createCaller(adminContext);
    const result = await caller.generateUserGroupJoinCode({
      userGroupId: mockUserGroupId,
    });

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(updateUserGroupJoinCode).toHaveBeenCalledWith({
      id: mockUserGroupId,
      joinCode: expect.any(String),
    });
    expect(result).toEqual(mockUserGroup);
  });

  it('should generate a join code for group leads', async () => {
    (getUserGroupMembership as jest.Mock).mockResolvedValue({
      userId: mockUserId,
      userGroupId: mockUserGroupId,
      role: UserGroupRole.Lead,
    });

    const caller = settingsRouter.createCaller(mockContext);
    const result = await caller.generateUserGroupJoinCode({
      userGroupId: mockUserGroupId,
    });

    expect(getUserGroupMembership).toHaveBeenCalledWith(
      mockUserId,
      mockUserGroupId,
    );
    expect(updateUserGroupJoinCode).toHaveBeenCalledWith({
      id: mockUserGroupId,
      joinCode: expect.any(String),
    });
    expect(result).toEqual(mockUserGroup);
  });

  it('should throw Forbidden error for regular members', async () => {
    jest.mocked(getUserGroupMembership).mockResolvedValue({
      userId: mockUserId,
      userGroupId: mockUserGroupId,
      role: UserGroupRole.User,
    });

    const caller = settingsRouter.createCaller(mockContext);
    await expect(
      caller.generateUserGroupJoinCode({ userGroupId: mockUserGroupId }),
    ).rejects.toThrow(TRPCError);

    expect(getUserGroupMembership).toHaveBeenCalledWith(
      mockUserId,
      mockUserGroupId,
    );
    expect(updateUserGroupJoinCode).not.toHaveBeenCalled();
  });

  it('should throw Forbidden error for non-members', async () => {
    jest.mocked(getUserGroupMembership).mockResolvedValue(null);

    const caller = settingsRouter.createCaller(mockContext);
    await expect(
      caller.generateUserGroupJoinCode({ userGroupId: mockUserGroupId }),
    ).rejects.toThrow(
      Forbidden('You do not have permission to access this resource'),
    );

    expect(getUserGroupMembership).toHaveBeenCalledWith(
      mockUserId,
      mockUserGroupId,
    );
    expect(updateUserGroupJoinCode).not.toHaveBeenCalled();
  });

  it('should generate an 8-character alphanumeric join code', async () => {
    const adminContext = {
      ...mockContext,
      userRole: UserRole.Admin,
    };

    const caller = settingsRouter.createCaller(adminContext);
    await caller.generateUserGroupJoinCode({ userGroupId: mockUserGroupId });

    const updateCall = jest.mocked(updateUserGroupJoinCode).mock.calls[0][0];
    expect(updateCall.joinCode).toMatch(/^[A-Za-z0-9]{8}$/);
  });

  it('should log and rethrow errors from updateUserGroupJoinCode', async () => {
    const adminContext = {
      ...mockContext,
      userRole: UserRole.Admin,
    };

    const mockError = new Error('Database error');
    jest.mocked(updateUserGroupJoinCode).mockRejectedValue(mockError);

    const caller = settingsRouter.createCaller(adminContext);
    await expect(
      caller.generateUserGroupJoinCode({ userGroupId: mockUserGroupId }),
    ).rejects.toThrow('Error generating user group join code');

    expect(adminContext.logger.error).toHaveBeenCalledWith(
      `Error generating user group join code for group ${mockUserGroupId}`,
      { cause: mockError },
    );
  });
});
