import db from '@/server/db';
import logger from '@/server/logger';
import createPrismJob from './createPrismJob';

jest.mock('@/server/db', () => ({
  agentPrismJob: {
    create: jest.fn(),
  },
}));

describe('createPrismJob', () => {
  const mockParams = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    aiAgentId: '223e4567-e89b-12d3-a456-426614174001',
    userId: '323e4567-e89b-12d3-a456-426614174002',
    requirementsFilename: 'requirements.xlsx',
    proposalFilename: 'proposal.docx',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (db.agentPrismJob.create as jest.Mock).mockResolvedValue({});
  });

  it('should create a job with correct parameters', async () => {
    await createPrismJob(mockParams);

    expect(db.agentPrismJob.create).toHaveBeenCalledWith({
      data: {
        id: mockParams.id,
        aiAgentId: mockParams.aiAgentId,
        userId: mockParams.userId,
        status: 'queued',
        requirementsFilename: mockParams.requirementsFilename,
        proposalFilename: mockParams.proposalFilename,
      },
    });
  });

  it('should set initial status to queued', async () => {
    await createPrismJob(mockParams);

    expect(db.agentPrismJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'queued' }),
      }),
    );
  });

  it('should throw when db create fails', async () => {
    (db.agentPrismJob.create as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(createPrismJob(mockParams)).rejects.toThrow('Error creating PRISM job');
  });

  it('should log error when db create fails', async () => {
    const mockError = new Error('DB error');
    (db.agentPrismJob.create as jest.Mock).mockRejectedValue(mockError);

    await expect(createPrismJob(mockParams)).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith('Error creating PRISM job: ', mockError);
  });
});
