import getPulseJobStatus from './getPulseJobStatus';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: { agentPulseJob: { findFirst: jest.fn() } },
}));

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockFindFirst = db.agentPulseJob.findFirst as jest.Mock;

describe('getPulseJobStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns status and errorMessage for the owner', async () => {
    mockFindFirst.mockResolvedValue({
      status: 'completed',
      errorMessage: null,
    });

    const result = await getPulseJobStatus('job-1', 'user-1', 'agent-1');

    expect(result).toEqual({
      status: 'completed',
      errorMessage: null,
    });
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-1', userId: 'user-1', aiAgentId: 'agent-1' } }),
    );
  });

  it('returns null for a job belonging to someone else', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await getPulseJobStatus('job-1', 'user-2', 'agent-1');

    expect(result).toBeNull();
  });

  // The worker reacts to its own queued job and has no agent id to check it against.
  it('reads the job without an agent when none is given', async () => {
    mockFindFirst.mockResolvedValue({ status: 'processing', errorMessage: null });

    await getPulseJobStatus('job-1', 'user-1', null);

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-1', userId: 'user-1' } }),
    );
  });

  it('re-throws a sanitized error when Prisma fails', async () => {
    mockFindFirst.mockRejectedValue(new Error('db down'));

    await expect(getPulseJobStatus('job-1', 'user-1', 'agent-1')).rejects.toThrow(
      'Failed to load PULSE job status',
    );
  });

  // A status outside the set every caller switches on would read as no state at all.
  it('refuses a status the app never writes, naming it only in the log', async () => {
    mockFindFirst.mockResolvedValue({ status: 'halfway', errorMessage: null });

    await expect(getPulseJobStatus('job-1', 'user-1', 'agent-1')).rejects.toThrow(
      'Failed to load PULSE job status',
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to load PULSE job status',
      expect.objectContaining({ error: 'Unrecognized PULSE job status: halfway' }),
    );
  });
});
