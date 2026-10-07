import countFullyDefaultedRows from './countFullyDefaultedRows';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: { agentPulseResult: { count: jest.fn() } },
}));

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockCount = db.agentPulseResult.count as jest.Mock;

describe('countFullyDefaultedRows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCount.mockResolvedValue(3);
  });

  it('reports how many responses ended up entirely on fallback values', async () => {
    await expect(countFullyDefaultedRows('job-1')).resolves.toBe(3);
  });

  it('counts only rows where every value was a fallback', async () => {
    await countFullyDefaultedRows('job-1');

    expect(mockCount).toHaveBeenCalledWith({
      where: { jobId: 'job-1', values: { some: {}, every: { wasDefaulted: true } } },
    });
  });

  it('reports none for a run where nothing fell back', async () => {
    mockCount.mockResolvedValue(0);

    await expect(countFullyDefaultedRows('job-1')).resolves.toBe(0);
  });

  it('throws a descriptive error when the read fails', async () => {
    mockCount.mockRejectedValue(new Error('db down'));

    await expect(countFullyDefaultedRows('job-1')).rejects.toThrow(
      'Failed to count fallback-only PULSE rows',
    );
  });
});
