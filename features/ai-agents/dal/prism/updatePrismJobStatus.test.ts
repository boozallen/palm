import db from '@/server/db';
import logger from '@/server/logger';
import updatePrismJobStatus from './updatePrismJobStatus';

jest.mock('@/server/db', () => ({
  agentPrismJob: {
    update: jest.fn(),
  },
}));

describe('updatePrismJobStatus', () => {
  const mockJobId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
    (db.agentPrismJob.update as jest.Mock).mockResolvedValue({});
  });

  it('should update job status with correct parameters', async () => {
    await updatePrismJobStatus(mockJobId, 'processing');

    expect(db.agentPrismJob.update).toHaveBeenCalledWith({
      where: { id: mockJobId },
      data: { status: 'processing' },
    });
  });

  it('should update to completed status', async () => {
    await updatePrismJobStatus(mockJobId, 'completed');

    expect(db.agentPrismJob.update).toHaveBeenCalledWith({
      where: { id: mockJobId },
      data: { status: 'completed' },
    });
  });

  it('should update to error status', async () => {
    await updatePrismJobStatus(mockJobId, 'error');

    expect(db.agentPrismJob.update).toHaveBeenCalledWith({
      where: { id: mockJobId },
      data: { status: 'error' },
    });
  });

  it('should throw when db update fails', async () => {
    (db.agentPrismJob.update as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(updatePrismJobStatus(mockJobId, 'processing')).rejects.toThrow(
      'Error updating PRISM job status',
    );
  });

  it('should log error when db update fails', async () => {
    const mockError = new Error('DB error');
    (db.agentPrismJob.update as jest.Mock).mockRejectedValue(mockError);

    await expect(updatePrismJobStatus(mockJobId, 'processing')).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith('Error updating PRISM job status: ', mockError);
  });
});
