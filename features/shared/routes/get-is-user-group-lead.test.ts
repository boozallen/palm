import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';
import getIsUserGroupLead from '@/features/shared/dal/getIsUserGroupLead';

jest.mock('@/features/shared/dal/getIsUserGroupLead');

describe('getIsUserGroupLead route', () => {
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: '15b7ec31-a080-472c-aa88-b2daac066812',
    } as unknown as ContextType;
  });

  it('should return true if user has a lead role in any user groups', async () => {
    const mockData = true;
    (getIsUserGroupLead as jest.Mock).mockResolvedValue(mockData);

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.getIsUserGroupLead()).resolves.toEqual({
      isUserGroupLead: mockData,
    });

    expect(getIsUserGroupLead).toHaveBeenCalled();
  });
  it('should return false if user is not a lead in any user groups', async () => {
    const mockData = false;
    (getIsUserGroupLead as jest.Mock).mockResolvedValue(mockData);

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.getIsUserGroupLead()).resolves.toEqual({
      isUserGroupLead: mockData,
    });

    expect(getIsUserGroupLead).toHaveBeenCalled();
  });
});
