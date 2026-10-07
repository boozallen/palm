import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getStudioUserGroups from '@/features/context-studio/dal/getStudioUserGroups';
import getUserContextStudioAccess from '@/features/shared/dal/getUserContextStudioAccess';
import contextStudioRouter from '@/features/context-studio/routes/index';

jest.mock('@/features/context-studio/dal/getStudioUserGroups');
jest.mock('@/features/shared/dal/getUserContextStudioAccess');

describe('getUserGroupsProcedure', () => {
  const mockUserId = 'd3a4a1f2-6c1e-4a2b-9f0d-2c8e5b7a1c34';
  const mockGroups = [
    { id: '3f6b1c1e-0000-4000-8000-000000000001', label: 'Default' },
    { id: '3f6b1c1e-0000-4000-8000-000000000002', label: 'Data & Analytics' },
  ];

  const ctx = {
    userId: mockUserId,
    userRole: UserRole.User,
  } as unknown as ContextType;

  const mockError = Forbidden('You do not have permission to access this resource');

  beforeEach(() => {
    jest.clearAllMocks();
    (getStudioUserGroups as jest.Mock).mockResolvedValue(mockGroups);
  });

  // The studio's own copy of this lookup exists because the Settings route is
  // gated to Admins and group Leads, which left the filter bar empty and
  // disabled for everyone else the studio grant admits.
  it('should return the groups a user with Context Studio access may filter by', async () => {
    (getUserContextStudioAccess as jest.Mock).mockResolvedValue(true);

    await expect(contextStudioRouter.createCaller(ctx).getUserGroups())
      .resolves.toEqual({ userGroups: mockGroups });

    expect(getUserContextStudioAccess).toHaveBeenCalledWith(mockUserId);
  });

  it('should throw error if the user lacks Context Studio access', async () => {
    (getUserContextStudioAccess as jest.Mock).mockResolvedValue(false);

    await expect(contextStudioRouter.createCaller(ctx).getUserGroups())
      .rejects.toThrow(mockError);

    expect(getStudioUserGroups).not.toHaveBeenCalled();
  });

  // Scoping happens in the DAL, so the route's job is to report the role
  // faithfully — passing the wrong flag would silently widen the list.
  it.each([
    [UserRole.User, false],
    [UserRole.Admin, true],
  ])('should scope the list for a %s by passing isAdmin=%s', async (userRole, isAdmin) => {
    (getUserContextStudioAccess as jest.Mock).mockResolvedValue(true);

    const roleCtx = { userId: mockUserId, userRole } as unknown as ContextType;
    await contextStudioRouter.createCaller(roleCtx).getUserGroups();

    expect(getStudioUserGroups).toHaveBeenCalledWith(mockUserId, isAdmin);
  });
});
