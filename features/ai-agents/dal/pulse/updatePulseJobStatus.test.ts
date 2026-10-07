import updatePulseJobStatus from './updatePulseJobStatus';
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

describe('updatePulseJobStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue({ id: 'job-1' });
  });

  it('sets the status and clears any previous error', async () => {
    await updatePulseJobStatus('job-1', 'processing');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'processing', errorMessage: null },
      select: { id: true },
    });
  });

  it('records an error message when one is given', async () => {
    await updatePulseJobStatus('job-1', 'error', 'Worksheet not found');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'error', errorMessage: 'Worksheet not found' },
      select: { id: true },
    });
  });

  it('throws a descriptive error when the update fails', async () => {
    mockUpdate.mockRejectedValue(new Error('db down'));

    await expect(updatePulseJobStatus('job-1', 'processing')).rejects.toThrow(
      'Failed to update PULSE job status',
    );
  });
});
