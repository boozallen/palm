import getAgentProviders from './getAgentProviders';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  agentProvider: {
    findMany: jest.fn(),
  },
}));

describe('getAgentProviders', () => {
  const mockProviders = [
    {
      id: 'test-id-1',
      name: 'Agent One',
      description: 'First agent',
      endpoint: 'https://agent-one.example.com',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'test-id-2',
      name: 'Agent Two',
      description: 'Second agent',
      endpoint: 'https://agent-two.example.com',
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns all non-deleted agent providers ordered by createdAt', async () => {
    (db.agentProvider.findMany as jest.Mock).mockResolvedValue(mockProviders);

    const result = await getAgentProviders();

    expect(db.agentProvider.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toEqual(
      mockProviders.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        endpoint: p.endpoint,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }))
    );
  });

  it('returns an empty array when no providers exist', async () => {
    (db.agentProvider.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getAgentProviders();

    expect(result).toEqual([]);
  });

  it('throws and logs when the db call fails', async () => {
    const dbError = new Error('DB connection failed');
    (db.agentProvider.findMany as jest.Mock).mockRejectedValue(dbError);

    await expect(getAgentProviders()).rejects.toThrow('Error fetching agent providers');

    expect(logger.error).toHaveBeenCalledWith('Error fetching agent providers', dbError);
  });
});
