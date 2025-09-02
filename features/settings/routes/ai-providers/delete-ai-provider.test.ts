import deleteAiProviderDal from '@/features/settings/dal/ai-providers/deleteAiProvider';
import { ContextType } from '@/server/trpc-context';
import settingsRouter from '@/features/settings/routes';
import { TRPCError } from '@trpc/server';
import { UserRole } from '@/features/shared/types/user';
import updateSystemConfigDefaultModel from '@/features/settings/dal/system-configurations/updateSystemConfigDefaultModel';

jest.mock('@/features/settings/dal/ai-providers/deleteAiProvider');
jest.mock('@/features/settings/dal/system-configurations/updateSystemConfigDefaultModel');

describe('deleteAiProviderRoute', () => {
  const input = { providerId: '32d288e0-683e-4fc1-b570-f76ed7caa6e8' };
  const mockUserId = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;
  });
  it('should delete AI Provider if user is admin', async () => {
    const mockReturnValue = { id: input.providerId };
    ctx.userRole = UserRole.Admin;

    (deleteAiProviderDal as jest.Mock).mockResolvedValue(mockReturnValue);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteAiProvider(input)).resolves.toEqual(mockReturnValue);
    expect(deleteAiProviderDal).toBeCalledWith(input.providerId);
    expect(updateSystemConfigDefaultModel).toBeCalledWith();
  });

  it('should throw an error if user is not an admin', async () => {

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteAiProvider(input)).rejects.toThrow(TRPCError);

    expect(deleteAiProviderDal).not.toBeCalled();
  });
});
