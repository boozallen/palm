import updatePulseJobResponseCount from './updatePulseJobResponseCount';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: { agentPulseJob: { update: jest.fn() } },
}));

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockUpdate = db.agentPulseJob.update as jest.Mock;

describe('updatePulseJobResponseCount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue({ id: 'job-1' });
  });

  it('records how many rows the mapping found', async () => {
    await updatePulseJobResponseCount('job-1', 120);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { responseCount: 120 },
      select: { id: true },
    });
  });

  it('throws a descriptive error when the update fails', async () => {
    mockUpdate.mockRejectedValue(new Error('db down'));

    await expect(updatePulseJobResponseCount('job-1', 120)).rejects.toThrow(
      'Failed to update PULSE response count',
    );
  });
});
