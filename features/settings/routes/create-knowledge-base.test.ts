import settingsRouter from '@/features/settings/routes';
import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import createKnowledgeBase from '@/features/settings/dal/createKnowledgeBase';
import { Forbidden } from '@/features/shared/errors/routeErrors';

jest.mock('@/features/settings/dal/createKnowledgeBase');

describe('createKnowledgeBaseRoute', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';

  const mockInput = {
    label: 'New Knowledge Base',
    externalId: 'new-kb',
    kbProviderId: 'ec5dd2cf-c867-4a81-b940-d22d98544a0c',
  };

  const ctx = {
    userId: mockUserId,
    userRole: UserRole.Admin,
  } as unknown as ContextType;

  const mockReturnValue = {
    id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c',
    label: 'New Knowledge Base',
    externalId: 'new-kb',
    kbProviderId: 'ec5dd2cf-c867-4a81-b940-d22d98544a0c',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create knowledge base if user is Admin', async () => {
    ctx.userRole = UserRole.Admin;

    (createKnowledgeBase as jest.Mock).mockResolvedValue(mockReturnValue);

    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.createKnowledgeBase(mockInput)
    ).resolves.toEqual(mockReturnValue);

    expect(createKnowledgeBase).toBeCalledWith(mockInput);
  });

  it('should not create knowledge base if user is not Admin', async () => {
    ctx.userRole = UserRole.User;

    const mockError = Forbidden('You do not have permission to access this resource');

    (createKnowledgeBase as jest.Mock).mockResolvedValue(mockReturnValue);

    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.createKnowledgeBase(mockInput)
    ).rejects.toThrow(mockError);

    expect(createKnowledgeBase).not.toBeCalled();
  });
});
