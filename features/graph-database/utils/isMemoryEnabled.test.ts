import { isMemoryEnabled } from '@/features/graph-database/utils/isMemoryEnabled';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';

jest.mock('@/features/shared/dal/getSystemConfig');

const mockGetSystemConfig = getSystemConfig as jest.MockedFunction<typeof getSystemConfig>;

describe('isMemoryEnabled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when the SystemConfig toggle is on', async () => {
    mockGetSystemConfig.mockResolvedValue({
      memoryEnabled: true,
    } as Awaited<ReturnType<typeof getSystemConfig>>);

    await expect(isMemoryEnabled()).resolves.toBe(true);
  });

  it('returns false when the SystemConfig toggle is off', async () => {
    mockGetSystemConfig.mockResolvedValue({
      memoryEnabled: false,
    } as Awaited<ReturnType<typeof getSystemConfig>>);

    await expect(isMemoryEnabled()).resolves.toBe(false);
  });

  it('defaults to false when the field is absent/undefined', async () => {
    mockGetSystemConfig.mockResolvedValue({} as Awaited<ReturnType<typeof getSystemConfig>>);

    await expect(isMemoryEnabled()).resolves.toBe(false);
  });
});
