import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import sharedRouter from '@/features/shared/routes/index';
import getWorkspaceStats from '@/features/shared/dal/getWorkspaceStats';

jest.mock('@/features/shared/dal/getWorkspaceStats');

describe('getWorkspaceStats route', () => {
  const ctx = {
    userRole: UserRole.User,
  } as unknown as ContextType;

  const mockResult = {
    chatsLast30Days: 15,
    documentsUploadedLast30Days: 8,
    artifactsGeneratedLast30Days: 6,
    citationsGeneratedLast30Days: 24,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getWorkspaceStats as jest.Mock).mockResolvedValue(mockResult);
  });

  it('returns aggregated workspace stats', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.getWorkspaceStats()).resolves.toEqual(mockResult);
    expect(getWorkspaceStats).toHaveBeenCalled();
  });
});
