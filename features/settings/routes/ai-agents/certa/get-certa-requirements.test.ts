import { UserRole } from '@/features/shared/types/user';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import logger from '@/server/logger';
import getFirstAvailableOpenAiModel from '@/features/settings/dal/getFirstAvailableOpenAiModel';
import { tryGetRedisClient } from '@/server/storage/redisConnection';

jest.mock('@/features/settings/dal/getFirstAvailableOpenAiModel');
jest.mock('@/server/storage/redisConnection');

describe('getCertaRequirements route', () => {
  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (getFirstAvailableOpenAiModel as jest.Mock).mockResolvedValue({
      id: 'gpt-4',
      name: 'GPT-4',
    });

    (tryGetRedisClient as jest.Mock).mockResolvedValue({
      ping: jest.fn().mockResolvedValue('PONG'),
    });

    mockCtx = {
      logger: logger,
      userRole: UserRole.Admin,
    } as unknown as ContextType;
  });

  it('should return configured: true when all systems are available', async () => {
    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.getCertaRequirements();

    expect(result).toEqual({
      configured: true,
      requirements: [
        {
          name: 'OpenAI Model',
          available: true,
        },
        {
          name: 'Redis Instance',
          available: true,
        },
      ],
    });
    expect(getFirstAvailableOpenAiModel).toHaveBeenCalled();
    expect(tryGetRedisClient).toHaveBeenCalled();
  });

  it('should throw an error if user is not Admin', async () => {
    mockCtx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.getCertaRequirements()).rejects.toThrow();

    expect(getFirstAvailableOpenAiModel).not.toHaveBeenCalled();
    expect(tryGetRedisClient).not.toHaveBeenCalled();
  });

  it('should return configured: false with OpenAI requirement available: false when OpenAI is unavailable', async () => {
    (getFirstAvailableOpenAiModel as jest.Mock).mockResolvedValue(null);

    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.getCertaRequirements();

    expect(result).toEqual({
      configured: false,
      requirements: [
        {
          name: 'OpenAI Model',
          available: false,
        },
        {
          name: 'Redis Instance',
          available: true,
        },
      ],
    });

    expect(getFirstAvailableOpenAiModel).toHaveBeenCalled();
    expect(tryGetRedisClient).toHaveBeenCalled();
  });

  it('should return configured: false with Redis requirement available: false when Redis is unavailable', async () => {
    (tryGetRedisClient as jest.Mock).mockResolvedValue(null);

    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.getCertaRequirements();

    expect(result).toEqual({
      configured: false,
      requirements: [
        {
          name: 'OpenAI Model',
          available: true,
        },
        {
          name: 'Redis Instance',
          available: false,
        },
      ],
    });

    expect(getFirstAvailableOpenAiModel).toHaveBeenCalled();
    expect(tryGetRedisClient).toHaveBeenCalled();
  });

  it('should return configured: false with multiple unavailable requirements when more than one requirement is unavailable', async () => {
    (getFirstAvailableOpenAiModel as jest.Mock).mockResolvedValue(null);
    (tryGetRedisClient as jest.Mock).mockResolvedValue(null);

    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.getCertaRequirements();

    expect(result).toEqual({
      configured: false,
      requirements: [
        {
          name: 'OpenAI Model',
          available: false,
        },
        {
          name: 'Redis Instance',
          available: false,
        },
      ],
    });

    expect(getFirstAvailableOpenAiModel).toHaveBeenCalled();
    expect(tryGetRedisClient).toHaveBeenCalled();
  });
});
