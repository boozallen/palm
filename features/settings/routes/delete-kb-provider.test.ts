import deleteKbProvider from '@/features/settings/dal/deleteKbProvider';
import { ContextType } from '@/server/trpc-context';
import settingsRouter from '@/features/settings/routes';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import updateSystemConfigDocumentLibraryKbProvider from '@/features/settings/dal/updateSystemConfigDocumentLibraryKbProvider';

jest.mock('@/features/settings/dal/deleteKbProvider');
jest.mock('@/features/settings/dal/updateSystemConfigDocumentLibraryKbProvider');

describe('deleteKbProviderRoute', () => {
  const input = { id: '32d288e0-683e-4fc1-b570-f76ed7caa6e8' };
  const mockUserId = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('should delete Kb Provider if user is admin', async () => {
    const mockReturnValue = { id: input.id };
    ctx.userRole = UserRole.Admin;

    (deleteKbProvider as jest.Mock).mockResolvedValue(mockReturnValue);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteKbProvider(input)).resolves.toEqual(mockReturnValue);
    expect(deleteKbProvider).toBeCalledWith(input.id);
    expect(updateSystemConfigDocumentLibraryKbProvider).toBeCalledWith(input.id);
  });

  it('should throw an error if user is not an admin', async () => {

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteKbProvider(input)).rejects.toThrow(
      Forbidden('You do not have permission to access this resource')
    );

    expect(deleteKbProvider).not.toBeCalled();
  });
});
