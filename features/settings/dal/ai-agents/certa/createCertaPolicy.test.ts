import db from '@/server/db';
import createCertaPolicy from './createCertaPolicy';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  agentCertaPolicy: {
    create: jest.fn(),
  },
}));

describe('createCertaPolicy', () => {
  const mockInput = {
    aiAgentId: '123',
    title: 'Test Policy',
    content: 'This is a test policy.',
    requirements: 'Test requirements',
  };

  (db.agentCertaPolicy.create as jest.Mock).mockResolvedValue({
    id: '123',
    ...mockInput,
  });

  beforeEach(jest.clearAllMocks);

  it('should create a new policy', async () => {
    await createCertaPolicy(mockInput);

    expect(db.agentCertaPolicy.create).toHaveBeenCalledWith({
      data: mockInput,
    });
  });

  it('should return the created policy', async () => {
    const result = await createCertaPolicy(mockInput);

    expect(result).toEqual({
      id: '123',
      aiAgentId: '123',
      title: 'Test Policy',
      content: 'This is a test policy.',
      requirements: 'Test requirements',
    });
  });

  it('should throw an error if creation fails', async () => {
    (db.agentCertaPolicy.create as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(createCertaPolicy(mockInput)).rejects.toThrow();
  });

  it('should log an error if creation fails', async () => {
    const mockError = new Error('DB error');
    (db.agentCertaPolicy.create as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(createCertaPolicy(mockInput)).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith(expect.any(String), mockError);
  });
});
