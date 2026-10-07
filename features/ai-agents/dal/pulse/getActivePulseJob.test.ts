import getActivePulseJob from './getActivePulseJob';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: { agentPulseJob: { findFirst: jest.fn() } },
}));

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockFindFirst = db.agentPulseJob.findFirst as jest.Mock;

describe('getActivePulseJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindFirst.mockResolvedValue(null);
  });

  it('looks for a queued or processing job for this user and agent', async () => {
    await getActivePulseJob('agent-1', 'user-1');

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          aiAgentId: 'agent-1',
          userId: 'user-1',
          status: { in: ['queued', 'processing'] },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('returns the in-flight job so a reloaded page can rejoin it', async () => {
    mockFindFirst.mockResolvedValue({ id: 'job-1', status: 'processing' });

    await expect(getActivePulseJob('agent-1', 'user-1')).resolves.toEqual({
      id: 'job-1',
      status: 'processing',
    });
  });

  it('returns null when nothing is running', async () => {
    await expect(getActivePulseJob('agent-1', 'user-1')).resolves.toBeNull();
  });

  it('throws a descriptive error when the read fails', async () => {
    mockFindFirst.mockRejectedValue(new Error('db down'));

    await expect(getActivePulseJob('agent-1', 'user-1')).rejects.toThrow(
      'Failed to load active PULSE job',
    );
  });
});
