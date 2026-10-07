import { ContextType } from '@/server/trpc-context';
import contextStudioRouter from '@/features/context-studio/routes';
import getUseCaseThemeInputs from '@/features/context-studio/dal/getUseCaseThemeInputs';
import getUseCaseThemes from '@/features/context-studio/dal/getUseCaseThemes';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { ThemeInputChat } from '@/features/context-studio/services/summarizeUseCaseThemes';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { UseCase } from '@/features/shared/types/use-case';
import { UserRole } from '@/features/shared/types/user';
import { UseCaseThemes } from '@/features/context-studio/types/use-case-detail';

jest.mock('@/features/context-studio/dal/getUseCaseThemeInputs');
jest.mock('@/features/context-studio/dal/getUseCaseThemes');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

describe('get-use-case-themes route', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockUserGroupId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';
  const mockChatId1 = '11111111-1111-1111-1111-111111111111';
  const mockChatId2 = '22222222-2222-2222-2222-222222222222';

  const mockCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
  } as unknown as ContextType;

  const mockChats: ThemeInputChat[] = [
    {
      chatId: mockChatId1,
      title: 'API design',
      artifactNames: ['schema.sql', 'api.ts'],
      excerpts: ['Rework the API for the Harbor Authority ERP recompete'],
      cost: 100.0,
    },
    {
      chatId: mockChatId2,
      title: 'Database schema',
      artifactNames: ['migration.sql'],
      excerpts: [],
      cost: 50.5,
    },
  ];

  const mockThemes: UseCaseThemes = {
    themes: [
      { name: 'Database work', chats: 1, cost: 50.5 },
      { name: 'API development', chats: 1, cost: 100.0 },
    ],
    remainder: null,
    coveredChats: 2,
    analyzedChats: 2,
    truncated: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Pass-through by default so argument-forwarding assertions below see the scope
    // unchanged; individual tests override this to exercise scoping.
    (scopeStudioQuery as jest.Mock).mockImplementation((_ctx, _userGroupId, userId) =>
      Promise.resolve({ isLead: false, restrictedUserId: userId }));
    (getUseCaseThemeInputs as jest.Mock).mockResolvedValue(mockChats);
    (getUseCaseThemes as jest.Mock).mockResolvedValue(mockThemes);
  });

  it('summarizes the chat set it was given', async () => {
    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getUseCaseThemes({
      timeRange: TimeRange.Month,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
      useCase: UseCase.Engineering,
    });

    expect(getUseCaseThemes).toHaveBeenCalledWith(UseCase.Engineering, mockChats, mockUserId, mockUserGroupId);
  });

  // Usage attribution: 'all' is a filter-bar sentinel, not a real group id, so the
  // AI spend behind the roll-up must land unattributed rather than tagged 'all'.
  it('does not forward the "all" sentinel as a userGroupId', async () => {
    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getUseCaseThemes({
      timeRange: TimeRange.Month,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: false,
      useCase: UseCase.Engineering,
    });

    expect(getUseCaseThemes).toHaveBeenCalledWith(UseCase.Engineering, mockChats, mockUserId, undefined);
  });

  it('returns null when no roll-up could be produced', async () => {
    (getUseCaseThemes as jest.Mock).mockResolvedValue(null);

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getUseCaseThemes({
      timeRange: TimeRange.Month,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
      useCase: UseCase.Engineering,
    });

    expect(response).toBeNull();
  });

  it('excludes admin users regardless of what the client sent', async () => {
    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getUseCaseThemes({
      timeRange: TimeRange.Month,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
      useCase: UseCase.Engineering,
    });

    expect(getUseCaseThemeInputs).toHaveBeenCalledWith(
      UseCase.Engineering,
      TimeRange.Month,
      mockUserGroupId,
      'all',
      true,
    );
  });

  // The roll-up reads chat titles and owner names, so a plain member asking for
  // 'all' must see only their own rows rather than the whole org's.
  it('passes the scoped restrictedUserId, not the raw input, to the DAL', async () => {
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: mockUserId });

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getUseCaseThemes({
      timeRange: TimeRange.Month,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
      useCase: UseCase.Engineering,
    });

    expect(getUseCaseThemeInputs).toHaveBeenCalledWith(
      UseCase.Engineering,
      TimeRange.Month,
      mockUserGroupId,
      mockUserId,
      true,
    );
  });
});
