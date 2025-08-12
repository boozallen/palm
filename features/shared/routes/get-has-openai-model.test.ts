import getUserFirstAvailableOpenAiModel from '@/features/shared/dal/getUserFirstAvailableOpenAiModel';
import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/shared/dal/getUserFirstAvailableOpenAiModel');

describe('getHasOpenAiModel procedure', () => {
  const userId = 'a7fa0a0b-7242-44e2-8dbb-23bbde53670f';
  const ctx = { userId } as ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when user has an available OpenAI model', async () => {
    const mockModel = {
      id: 'd72f155f-7b9a-4ff5-9f08-7c7f0c02f93e',
      aiProviderId: 'c54a871d-bc7c-453e-8e39-5c4ac60cc2c0',
      name: 'gpt-4',
      externalId: 'gpt-4',
      costPerInputToken: 0.03,
      costPerOutputToken: 0.06,
    };

    (getUserFirstAvailableOpenAiModel as jest.Mock).mockResolvedValue(mockModel);

    const caller = sharedRouter.createCaller(ctx);
    const result = await caller.getHasOpenAiModel();

    expect(result).toBe(true);
    expect(getUserFirstAvailableOpenAiModel).toHaveBeenCalledWith(userId);
  });

  it('returns false when user has no available OpenAI model', async () => {
    (getUserFirstAvailableOpenAiModel as jest.Mock).mockResolvedValue(null);

    const caller = sharedRouter.createCaller(ctx);
    const result = await caller.getHasOpenAiModel();

    expect(result).toBe(false);
    expect(getUserFirstAvailableOpenAiModel).toHaveBeenCalledWith(userId);
  });

  it('throws internal errors from DAL', async () => {
    const dalError = new Error('Error fetching OpenAI model');
    (getUserFirstAvailableOpenAiModel as jest.Mock).mockRejectedValue(dalError);

    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.getHasOpenAiModel()).rejects.toThrow('Error fetching OpenAI model');
    expect(getUserFirstAvailableOpenAiModel).toHaveBeenCalledWith(userId);
  });
});
