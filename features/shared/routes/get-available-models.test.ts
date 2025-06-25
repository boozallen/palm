import { AvailableModel } from '@/features/shared/types/model';
import getAvailableModels from '@/features/shared/dal/getAvailableModels';
import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/shared/dal/getAvailableModels');

describe('get-available-models route', () => {
  const mockDalResolvedValue: AvailableModel[] = [
    {
      id: 'a7e3f7e6-47cb-4448-9da3-b13e59d01fac',
      aiProviderId: '73576ac3-5034-4caf-8a04-6a73b5fabb34',
      name: 'GPT 4o',
      providerLabel: 'OpenAI',
      externalId: 'gpt-4o',
      costPerInputToken: 0,
      costPerOutputToken: 0,
    },
  ];

  const mockUserId = 'd45c22df-ab6d-477e-9080-844b7a934a6d';

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (getAvailableModels as jest.Mock).mockResolvedValue(mockDalResolvedValue);

    ctx = {
      userId: mockUserId,
    } as unknown as ContextType;
  });

  it('returns available models', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.getAvailableModels({})).resolves.toEqual({
      availableModels: mockDalResolvedValue.map((model) => ({
        id: model.id,
        name: model.name,
        providerLabel: model.providerLabel,
      })),
    });
  });

  it('throws error if DAL throws error', async () => {
    (getAvailableModels as jest.Mock).mockRejectedValueOnce(
      new Error('Test error'),
    );

    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.getAvailableModels({})).rejects.toThrow();
  });
});
