import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import deleteAiProviderModelDal from '@/features/settings/dal/deleteAiProviderModel';
import updateSystemConfigDefaultModel from '@/features/settings/dal/updateSystemConfigDefaultModel';
import settingsRouter from '@/features/settings/routes';
import { TRPCError } from '@trpc/server';

jest.mock('@/features/settings/dal/deleteAiProviderModel');
jest.mock('@/features/settings/dal/updateSystemConfigDefaultModel');

describe('deleteAiProviderModelRoute', () => {
  const input = { modelId: '32d288e0-683e-4fc1-b570-f76ed7caa6e8' };
  const mockUserId = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('should delete AI Model if user is admin', async () => {
    const mockReturnValue = { id: input.modelId };
    ctx.userRole = UserRole.Admin;

    (deleteAiProviderModelDal as jest.Mock).mockResolvedValue(mockReturnValue);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteAiProviderModel(input)).resolves.toEqual(
      mockReturnValue
    );
    expect(deleteAiProviderModelDal).toBeCalledWith(input.modelId);
    expect(updateSystemConfigDefaultModel).toBeCalledWith();
  });

  it('should throw error if user is not an admin', async () => {
    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteAiProviderModel(input)).rejects.toThrow(
      TRPCError
    );

    expect(deleteAiProviderModelDal).not.toBeCalled();
  });
});
