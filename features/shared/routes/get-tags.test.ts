import { Unauthorized } from '@/features/shared/errors/routeErrors';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import getTags from '@/features/shared/dal/getTags';
import sharedRouter from '@/features/shared/routes/index';

jest.mock('@/features/shared/dal/getTags');

describe('getTagsRoute', () => {
  const mockPromptTags = ['tag1', 'tag2', 'someOtherValue'];
  const mockFilteredPromptTags = ['tag1', 'tag2'];

  const mockUserId = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';
  const mockError = Unauthorized(
    'You do not have permission to access this resource'
  );

  let ctx: ContextType;
  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;

    (getTags as jest.Mock).mockImplementation((query) => {
      if (query === 'tag') {
        return Promise.resolve(mockFilteredPromptTags);
      }
      return Promise.resolve(mockPromptTags);
    });
  });

  it('should get all tags', async () => {
    const caller = sharedRouter.createCaller(ctx);
    const result = await caller.getTags({ query: '' });
    expect(result).toEqual({ tags: mockPromptTags });
  });

  it('should get filtered tags', async () => {
    const caller = sharedRouter.createCaller(ctx);
    const result = await caller.getTags({ query: 'tag' });
    expect(result).toEqual({ tags: mockFilteredPromptTags });
  });

  it('fail if there is no user session', async () => {
    ctx = {
      userId: null,
    } as unknown as ContextType;

    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.getTags({ query: '' })).rejects.toThrow(mockError);

    expect(getTags).not.toHaveBeenCalled();
  });
});
