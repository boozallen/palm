import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import settingsRouter from '@/features/settings/routes';
import deleteKnowledgeBase from '@/features/settings/dal/kb-providers/deleteKnowledgeBase';
import { Forbidden } from '@/features/shared/errors/routeErrors';

jest.mock('@/features/settings/dal/kb-providers/deleteKnowledgeBase', () => jest.fn());

describe('deleteKnowledgeBaseRoute', () => {
  const mockInput = { id: '32d288e0-683e-4fc1-b570-f76ed7caa6e8' };

  const mockOutput = { id: '32d288e0-683e-4fc1-b570-f76ed7caa6e8' };

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = {
      userId: mockInput.id,
    } as unknown as ContextType;
  });

  it('should delete a knowledge base successfully if user is an admin', async () => {
    ctx.userRole = UserRole.Admin;

    (deleteKnowledgeBase as jest.Mock).mockResolvedValue({ id: mockInput.id });

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteKnowledgeBase(mockInput)).resolves.toEqual(
      mockOutput
    );
    expect(deleteKnowledgeBase).toBeCalledWith(mockInput.id);
  });

  it('should throw an error if user is not an admin', async () => {
    ctx.userRole = UserRole.User;

    const mockError = Forbidden(
      'You do not have permission to access this resource'
    );

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteKnowledgeBase(mockInput)).rejects.toThrow(
      mockError
    );

    expect(deleteKnowledgeBase).not.toBeCalled();
  });
});
