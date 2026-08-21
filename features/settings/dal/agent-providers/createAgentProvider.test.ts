import createAgentProvider from './createAgentProvider';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  agentProvider: {
    create: jest.fn(),
  },
}));

describe('createAgentProvider', () => {
  const mockProvider = {
    id: 'test-id-1',
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

  it('creates an agent provider and returns the record', async () => {
    (db.agentProvider.create as jest.Mock).mockResolvedValue(mockProvider);

    const result = await createAgentProvider({
      name: 'Test Agent',
      description: 'A test agent',
      endpoint: 'https://agent.example.com',
      apiKey: 'secret-key',
    });

    expect(db.agentProvider.create).toHaveBeenCalledWith({
      data: {
        name: 'Test Agent',
        description: 'A test agent',
        endpoint: 'https://agent.example.com',
        apiKey: 'secret-key',
      },
    });
    expect(result).toEqual(mockProvider);
  });

  it('stores null for apiKey when not provided', async () => {
    const providerWithoutKey = { ...mockProvider, apiKey: null };
    (db.agentProvider.create as jest.Mock).mockResolvedValue(providerWithoutKey);

    const result = await createAgentProvider({
      name: 'Test Agent',
      description: 'A test agent',
      endpoint: 'https://agent.example.com',
    });

    expect(db.agentProvider.create).toHaveBeenCalledWith({
      data: {
        name: 'Test Agent',
        description: 'A test agent',
        endpoint: 'https://agent.example.com',
        apiKey: null,
      },
    });
    expect(result.apiKey).toBeNull();
  });

  it('throws and logs when the db call fails', async () => {
    const dbError = new Error('DB connection failed');
    (db.agentProvider.create as jest.Mock).mockRejectedValue(dbError);

    await expect(
      createAgentProvider({ name: 'Test', description: '', endpoint: 'https://example.com' })
    ).rejects.toThrow('Error creating agent provider');

    expect(logger.error).toHaveBeenCalledWith('Error creating agent provider', dbError);
  });
});
