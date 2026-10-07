import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { ContextType } from '@/server/trpc-context';
import getUserGroupMemberships from '@/features/settings/dal/user-groups/getUserGroupMemberships';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import contextStudioRouter from '@/features/context-studio/routes/index';

jest.mock('@/features/settings/dal/user-groups/getUserGroupMemberships');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

describe('getUserGroupMembersProcedure', () => {
  const mockUserId = 'd3a4a1f2-6c1e-4a2b-9f0d-2c8e5b7a1c34';
  const mockUserGroupId = '3f6b1c1e-0000-4000-8000-000000000001';

  const ctx = {
    userId: mockUserId,
    userRole: UserRole.User,
  } as unknown as ContextType;

  const otherMemberId = '7c5a5f3c-14e9-4a23-b307-4bf4ddcfda84';

  const mockMemberships = [
    {
      userGroupId: mockUserGroupId,
      userId: otherMemberId,
      name: 'Test User',
      role: UserGroupRole.User,
      email: 'test@example.com',
      lastLoginAt: new Date('2026-06-01'),
    },
    {
      userGroupId: mockUserGroupId,
      userId: mockUserId,
      name: 'Viewer',
      role: UserGroupRole.User,
      email: 'viewer@example.com',
      lastLoginAt: new Date('2026-06-01'),
    },
  ];

  const callRoute = (userGroupId: string = mockUserGroupId) =>
    contextStudioRouter.createCaller(ctx).getUserGroupMembers({ userGroupId });

  beforeEach(() => {
    jest.clearAllMocks();
    (getUserGroupMemberships as jest.Mock).mockResolvedValue(mockMemberships);
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: true, restrictedUserId: 'all' });
  });

  it('returns every member of a group the viewer leads', async () => {
    await expect(callRoute()).resolves.toEqual({
      members: [
        { userId: otherMemberId, name: 'Test User' },
        { userId: mockUserId, name: 'Viewer' },
      ],
    });
  });

  // The member list is only ever used to populate the User filter, so it exposes
  // nothing the dropdown does not need. Email and last-login stay server-side.
  it('does not expose member fields beyond the filter label', async () => {
    const result = await callRoute();

    expect(Object.keys(result.members[0])).toEqual(['userId', 'name']);
  });

  // Without this, a plain member could use the dropdown to enumerate every
  // named member of a group, even though they may only filter costs down to
  // themselves.
  it('limits a non-Lead member to only their own name', async () => {
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: mockUserId });

    await expect(callRoute()).resolves.toEqual({
      members: [{ userId: mockUserId, name: 'Viewer' }],
    });
  });

  it('requests the studio scope for the requested group', async () => {
    await callRoute(mockUserGroupId);

    expect(scopeStudioQuery).toHaveBeenCalledWith(ctx, mockUserGroupId, 'all');
  });

  // Covers both the missing-grant and group-not-visible cases, which
  // scopeStudioQuery already rejects before this route does anything else.
  it('throws and does not look up members when the studio scope check rejects', async () => {
    const mockError = new Error('You do not have permission to access this resource');
    (scopeStudioQuery as jest.Mock).mockRejectedValue(mockError);

    await expect(callRoute()).rejects.toThrow(mockError.message);

    expect(getUserGroupMemberships).not.toHaveBeenCalled();
  });
});
