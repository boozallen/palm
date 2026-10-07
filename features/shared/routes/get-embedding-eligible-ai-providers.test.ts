import getEmbeddingEligibleAiProviderIds from '@/features/shared/dal/getEmbeddingEligibleAiProviderIds';
import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/shared/dal/getEmbeddingEligibleAiProviderIds');

describe('get-embedding-eligible-ai-providers route', () => {
  const mockUserId = 'd45c22df-ab6d-477e-9080-844b7a934a6d';

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
    } as unknown as ContextType;
  });

  it('returns the eligible AI provider ids', async () => {
    (getEmbeddingEligibleAiProviderIds as jest.Mock).mockResolvedValue(['provider-1', 'provider-2']);

    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.getEmbeddingEligibleAiProviders()).resolves.toEqual({
      aiProviderIds: ['provider-1', 'provider-2'],
    });
  });

  it('throws error if DAL throws error', async () => {
    (getEmbeddingEligibleAiProviderIds as jest.Mock).mockRejectedValueOnce(
      new Error('Test error'),
    );

    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.getEmbeddingEligibleAiProviders()).rejects.toThrow();
  });
});
