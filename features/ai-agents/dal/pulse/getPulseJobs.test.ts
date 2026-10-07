import getPulseJobs from './getPulseJobs';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: { agentPulseJob: { findMany: jest.fn() } },
}));

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockFindMany = db.agentPulseJob.findMany as jest.Mock;

describe('getPulseJobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  it('lists only this user jobs for this agent, newest first', async () => {
    await getPulseJobs('agent-1', 'user-1');

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { aiAgentId: 'agent-1', userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('returns the jobs it found', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'job-1',
        status: 'completed',
        surveyFilename: 'symposium.xlsx',
        responseCount: 120,
        createdAt: new Date('2026-09-14T00:00:00Z'),
      },
    ]);

    const jobs = await getPulseJobs('agent-1', 'user-1');

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ id: 'job-1', responseCount: 120 });
  });

  it('throws a descriptive error when the read fails', async () => {
    mockFindMany.mockRejectedValue(new Error('db down'));

    await expect(getPulseJobs('agent-1', 'user-1')).rejects.toThrow('Failed to load PULSE jobs');
  });
});
