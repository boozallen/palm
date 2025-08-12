import { UserRole } from '@/features/shared/types/user';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import logger from '@/server/logger';
import { tryGetRedisClient } from '@/server/storage/redisConnection';
import { RequirementNames } from '@/features/settings/types/system-requirements';

jest.mock('@/server/storage/redisConnection');

describe('getRadarRequirements route', () => {
  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (tryGetRedisClient as jest.Mock).mockResolvedValue({
      ping: jest.fn().mockResolvedValue('PONG'),
    });

    mockCtx = {
      logger: logger,
      userRole: UserRole.Admin,
    } as unknown as ContextType;
  });

  it('should return configured: true when redis are available', async () => {
    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.getRadarRequirements();

    expect(result).toEqual({
      configured: true,
      requirements: [
        {
          name: RequirementNames.REDIS_INSTANCE,
          available: true,
        },
      ],
    });
    expect(tryGetRedisClient).toHaveBeenCalled();
  });

  it('should throw an error if user is not Admin', async () => {
    mockCtx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.getRadarRequirements()).rejects.toThrow();

    expect(tryGetRedisClient).not.toHaveBeenCalled();
  });

  it('should return configured: false with Redis requirement available: false when Redis is unavailable', async () => {
    (tryGetRedisClient as jest.Mock).mockResolvedValue(null);

    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.getRadarRequirements();

    expect(result).toEqual({
      configured: false,
      requirements: [
        {
          name: RequirementNames.REDIS_INSTANCE,
          available: false,
        },
      ],
    });

    expect(tryGetRedisClient).toHaveBeenCalled();
  });
});
