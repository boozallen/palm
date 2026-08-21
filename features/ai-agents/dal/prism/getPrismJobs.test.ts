import db from '@/server/db';
import logger from '@/server/logger';
import getPrismJobs from './getPrismJobs';

jest.mock('@/server/db', () => ({
  agentPrismJob: {
    findMany: jest.fn(),
  },
}));

describe('getPrismJobs', () => {
  const mockAgentId = '123e4567-e89b-12d3-a456-426614174000';
  const mockUserId = '223e4567-e89b-12d3-a456-426614174001';

  const mockJobs = [
    {
      id: 'job-1',
      aiAgentId: mockAgentId,
      userId: mockUserId,
      status: 'completed',
      requirementsFilename: 'requirements.xlsx',
      proposalFilename: 'proposal.docx',
      createdAt: new Date('2024-01-02'),
    },
    {
      id: 'job-2',
      aiAgentId: mockAgentId,
      userId: mockUserId,
      status: 'completed',
      requirementsFilename: 'requirements-v2.xlsx',
      proposalFilename: 'proposal-v2.docx',
      createdAt: new Date('2024-01-01'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (db.agentPrismJob.findMany as jest.Mock).mockResolvedValue(mockJobs);
  });

  it('should query with correct parameters', async () => {
    await getPrismJobs(mockAgentId, mockUserId);

    expect(db.agentPrismJob.findMany).toHaveBeenCalledWith({
      where: { aiAgentId: mockAgentId, userId: mockUserId },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('should return jobs ordered by createdAt desc', async () => {
    const result = await getPrismJobs(mockAgentId, mockUserId);

    expect(result).toEqual(mockJobs);
    expect(result[0].createdAt.getTime()).toBeGreaterThan(result[1].createdAt.getTime());
  });

  it('should return empty array when no jobs found', async () => {
    (db.agentPrismJob.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getPrismJobs(mockAgentId, mockUserId);

    expect(result).toEqual([]);
  });

  it('should scope results to both agentId and userId', async () => {
    await getPrismJobs(mockAgentId, mockUserId);

    expect(db.agentPrismJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { aiAgentId: mockAgentId, userId: mockUserId },
      }),
    );
  });

  it('should throw when db query fails', async () => {
    (db.agentPrismJob.findMany as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(getPrismJobs(mockAgentId, mockUserId)).rejects.toThrow('Error fetching PRISM jobs');
  });

  it('should log error when db query fails', async () => {
    const mockError = new Error('DB error');
    (db.agentPrismJob.findMany as jest.Mock).mockRejectedValue(mockError);

    await expect(getPrismJobs(mockAgentId, mockUserId)).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith('Error fetching PRISM jobs: ', mockError);
  });
});
