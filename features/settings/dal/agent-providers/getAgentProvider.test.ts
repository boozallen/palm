import getAgentProvider from './getAgentProvider';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  agentProvider: {
    findFirst: jest.fn(),
  },
}));

describe('getAgentProvider', () => {
  const mockId = 'test-id-1';

  const mockProvider = {
    id: mockId,
    name: 'Test Agent',
    description: 'A test agent',
    endpoint: 'https://agent.example.com',
    apiKey: 'secret-key',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the agent provider when found', async () => {
    (db.agentProvider.findFirst as jest.Mock).mockResolvedValue(mockProvider);

    const result = await getAgentProvider(mockId);

    expect(db.agentProvider.findFirst).toHaveBeenCalledWith({
      where: { id: mockId, deletedAt: null },
    });
    expect(result).toEqual(mockProvider);
  });

  it('throws when the agent provider is not found', async () => {
    (db.agentProvider.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(getAgentProvider(mockId)).rejects.toThrow('Agent provider not found');
  });

  it('rethrows Error instances from the db', async () => {
    const dbError = new Error('DB connection failed');
    (db.agentProvider.findFirst as jest.Mock).mockRejectedValue(dbError);

    await expect(getAgentProvider(mockId)).rejects.toThrow('DB connection failed');

    expect(logger.error).toHaveBeenCalledWith('Error fetching agent provider', dbError);
  });
});
