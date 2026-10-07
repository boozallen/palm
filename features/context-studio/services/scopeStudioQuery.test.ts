import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getStudioUserGroups from '@/features/context-studio/dal/getStudioUserGroups';
import getUserContextStudioAccess from '@/features/shared/dal/getUserContextStudioAccess';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import scopeStudioQuery from './scopeStudioQuery';

jest.mock('@/features/context-studio/dal/getStudioUserGroups');
jest.mock('@/features/shared/dal/getUserContextStudioAccess');
jest.mock('@/features/settings/dal/user-groups/getUserGroupMembership');

describe('scopeStudioQuery', () => {
  const userId = 'd3a4a1f2-6c1e-4a2b-9f0d-2c8e5b7a1c34';
  const otherUserId = '9a1b2c3d-4e5f-6789-a0b1-c2d3e4f5a6b7';
  const visibleGroupId = 'b003fe12-5138-4ab5-bb64-a4a1ca8f775a';
  const hiddenGroupId = 'b13849b4-0350-49cd-a170-dd0b5bd6b560';

  const memberCtx = { userId, userRole: UserRole.User };
  const adminCtx = { userId, userRole: UserRole.Admin };

  const mockError = Forbidden('You do not have permission to access this resource');

  beforeEach(() => {
    jest.clearAllMocks();
    (getUserContextStudioAccess as jest.Mock).mockResolvedValue(true);
    (getStudioUserGroups as jest.Mock).mockResolvedValue([
      { id: visibleGroupId, label: 'Default', isLead: false },
    ]);
  });

  it('should throw if the viewer lacks the Context Studio grant', async () => {
    (getUserContextStudioAccess as jest.Mock).mockResolvedValue(false);

    await expect(scopeStudioQuery(memberCtx, 'all', 'all')).rejects.toThrow(mockError);
  });

  it('should throw for a group the viewer may not filter by', async () => {
    await expect(scopeStudioQuery(memberCtx, hiddenGroupId, 'all')).rejects.toThrow(mockError);
  });

  it('should force restrictedUserId to self for an unnamed request to a group with no per-viewer restriction', async () => {
    const scope = await scopeStudioQuery(memberCtx, visibleGroupId, 'all');

    expect(scope).toEqual({ isLead: false, restrictedUserId: userId });
  });

  it('should let a non-Lead member request their own id', async () => {
    const scope = await scopeStudioQuery(memberCtx, visibleGroupId, userId);

    expect(scope).toEqual({ isLead: false, restrictedUserId: userId });
  });

  // Without this a plain member could still read another named member's
  // individual data by requesting that member's id directly.
  it('should throw when a non-Lead member requests another member\'s id', async () => {
    await expect(scopeStudioQuery(memberCtx, visibleGroupId, otherUserId)).rejects.toThrow(mockError);
  });

  // A group selector of 'all' has no group to check Lead status against, so it
  // must not become a way to bypass the per-member restriction.
  it('should throw when a non-Lead member requests another member\'s id with no group selected', async () => {
    await expect(scopeStudioQuery(memberCtx, 'all', otherUserId)).rejects.toThrow(mockError);
  });

  describe('group Lead', () => {
    beforeEach(() => {
      (getStudioUserGroups as jest.Mock).mockResolvedValue([
        { id: visibleGroupId, label: 'Default', isLead: true },
      ]);
    });

    it('should let a Lead request another member\'s id within a group they lead', async () => {
      (getUserGroupMembership as jest.Mock).mockResolvedValue({
        userGroupId: visibleGroupId,
        userId: otherUserId,
        role: 'User',
      });

      const scope = await scopeStudioQuery(memberCtx, visibleGroupId, otherUserId);

      expect(getUserGroupMembership).toHaveBeenCalledWith(otherUserId, visibleGroupId);
      expect(scope).toEqual({ isLead: true, restrictedUserId: otherUserId });
    });

    // Without this a Lead of even a single-person group could read any org
    // user's individual data by pairing their led group with that user's id.
    it('should throw when a Lead requests an id who is not a member of the group they lead', async () => {
      (getUserGroupMembership as jest.Mock).mockResolvedValue(null);

      await expect(scopeStudioQuery(memberCtx, visibleGroupId, otherUserId)).rejects.toThrow(mockError);
    });

    it('should not force restrictedUserId to self for a group they lead', async () => {
      const scope = await scopeStudioQuery(memberCtx, visibleGroupId, 'all');

      expect(scope.restrictedUserId).toBe('all');
      expect(getUserGroupMembership).not.toHaveBeenCalled();
    });
  });

  describe('Admin', () => {
    it('should skip the group visibility lookup entirely', async () => {
      await scopeStudioQuery(adminCtx, hiddenGroupId, otherUserId);

      expect(getStudioUserGroups).not.toHaveBeenCalled();
    });

    it('should let an Admin request any member\'s id in any group without a membership lookup', async () => {
      const scope = await scopeStudioQuery(adminCtx, hiddenGroupId, otherUserId);

      expect(getUserGroupMembership).not.toHaveBeenCalled();
      expect(scope).toEqual({ isLead: true, restrictedUserId: otherUserId });
    });
  });
});
