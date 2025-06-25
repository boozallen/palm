import getUserGroups from '@/features/profile/dal/getUserGroups';
import profileRouter from '@/features/profile/routes';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/profile/dal/getUserGroups');

describe('get-user-groups route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return the current users groups', async () => {
    const userId = 'f2051721-1365-4d78-82a6-af8eef2b6b47';
    const mockData = [
      {
        id: '189a6048-a35b-4eff-bc56-596900b4a8bf',
        label: 'label1',
        role: 'User',
      },
      {
        id: '949e1ebf-a88d-4ec1-af76-9592309d8fe5',
        label: 'label2',
        role: 'Lead',
      },
    ];
    (getUserGroups as jest.Mock).mockResolvedValue(mockData);
    const ctx = { userId } as ContextType;
    const caller = profileRouter.createCaller(ctx);

    await expect(caller.getUserGroups()).resolves.toEqual({
      userGroups: mockData,
    });
    expect(getUserGroups).toHaveBeenCalledWith(userId);
  });
});
