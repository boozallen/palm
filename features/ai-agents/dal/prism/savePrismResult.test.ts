import db from '@/server/db';
import logger from '@/server/logger';
import savePrismResult from './savePrismResult';

jest.mock('@/server/db', () => ({
  agentPrismResult: {
    create: jest.fn(),
  },
}));

describe('savePrismResult', () => {
  const mockParams = {
    jobId: '123e4567-e89b-12d3-a456-426614174000',
    category: 'Technical',
    requirement: 'The system shall support 1,000 concurrent users.',
    complianceStatus: 'YES',
    reasoning: 'The proposal states the system will support up to 5,000 concurrent users.',
    citations: 'Our platform scales horizontally to support up to 5,000 concurrent users.',
    sortOrder: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (db.agentPrismResult.create as jest.Mock).mockResolvedValue({});
  });

  it('should create a result with correct parameters', async () => {
    await savePrismResult(mockParams);

    expect(db.agentPrismResult.create).toHaveBeenCalledWith({ data: mockParams });
  });

  it('should handle null category', async () => {
    const params = { ...mockParams, category: null };

    await savePrismResult(params);

    expect(db.agentPrismResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ category: null }),
    });
  });

  it('should handle null citations', async () => {
    const params = { ...mockParams, citations: null };

    await savePrismResult(params);

    expect(db.agentPrismResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ citations: null }),
    });
  });

  it('should throw when db create fails', async () => {
    (db.agentPrismResult.create as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(savePrismResult(mockParams)).rejects.toThrow('Error saving PRISM result');
  });

  it('should log error when db create fails', async () => {
    const mockError = new Error('DB error');
    (db.agentPrismResult.create as jest.Mock).mockRejectedValue(mockError);

    await expect(savePrismResult(mockParams)).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith('Error saving PRISM result: ', mockError);
  });
});
