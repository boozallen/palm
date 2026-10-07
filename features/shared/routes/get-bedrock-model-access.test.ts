import getBedrockModelAccess from '@/features/shared/dal/getBedrockModelAccess';
import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/shared/dal/getBedrockModelAccess');

describe('get-bedrock-model-access route', () => {
  const mockUserId = 'user-123';

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
    } as unknown as ContextType;
  });

  it('should return hasAccess: true when user has access', async () => {
    (getBedrockModelAccess as jest.Mock).mockResolvedValue(true);

    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.getBedrockModelAccess()).resolves.toEqual({
      hasAccess: true,
    });
    expect(getBedrockModelAccess).toHaveBeenCalledWith(mockUserId);
  });

  it('should return hasAccess: false when user has no access', async () => {
    (getBedrockModelAccess as jest.Mock).mockResolvedValue(false);

    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.getBedrockModelAccess()).resolves.toEqual({
      hasAccess: false,
    });
    expect(getBedrockModelAccess).toHaveBeenCalledWith(mockUserId);
  });

  it('should propagate errors from DAL function', async () => {
    (getBedrockModelAccess as jest.Mock).mockRejectedValue(
      new Error('Database error'),
    );

    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.getBedrockModelAccess()).rejects.toThrow();
  });
});