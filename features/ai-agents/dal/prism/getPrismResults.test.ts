import db from '@/server/db';
import logger from '@/server/logger';
import getPrismResults from './getPrismResults';

jest.mock('@/server/db', () => ({
  agentPrismResult: {
    findMany: jest.fn(),
  },
}));

describe('getPrismResults', () => {
  const mockJobId = '123e4567-e89b-12d3-a456-426614174000';

  const mockResults = [
    {
      id: 'result-1',
      jobId: mockJobId,
      category: 'Technical',
      requirement: 'The system shall support 1,000 concurrent users.',
      complianceStatus: 'YES',
      reasoning: 'Proposal addresses this requirement.',
      citations: 'Our platform supports up to 5,000 concurrent users.',
      sortOrder: 0,
    },
    {
      id: 'result-2',
      jobId: mockJobId,
      category: 'Technical',
      requirement: 'All data shall be encrypted using TLS 1.2 or higher.',
      complianceStatus: 'YES',
      reasoning: 'TLS 1.3 is mentioned in the proposal.',
      citations: 'All communications are encrypted using TLS 1.3.',
      sortOrder: 1,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (db.agentPrismResult.findMany as jest.Mock).mockResolvedValue(mockResults);
  });

  it('should query with correct parameters', async () => {
    await getPrismResults(mockJobId);

    expect(db.agentPrismResult.findMany).toHaveBeenCalledWith({
      where: { jobId: mockJobId },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  });

  it('should return results', async () => {
    const result = await getPrismResults(mockJobId);

    expect(result).toEqual(mockResults);
  });

  it('should return empty array when no results found', async () => {
    (db.agentPrismResult.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getPrismResults(mockJobId);

    expect(result).toEqual([]);
  });

  it('should throw when db query fails', async () => {
    (db.agentPrismResult.findMany as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(getPrismResults(mockJobId)).rejects.toThrow('Error fetching PRISM results');
  });

  it('should log error when db query fails', async () => {
    const mockError = new Error('DB error');
    (db.agentPrismResult.findMany as jest.Mock).mockRejectedValue(mockError);

    await expect(getPrismResults(mockJobId)).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith('Error fetching PRISM results: ', mockError);
  });
});
