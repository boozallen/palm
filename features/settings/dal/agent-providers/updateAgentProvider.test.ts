import updateAgentProvider from './updateAgentProvider';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  agentProvider: {
    update: jest.fn(),
  },
}));

describe('updateAgentProvider', () => {
  const mockId = 'test-id-1';

  const mockInput = {
    id: mockId,
    name: 'Updated Agent',
    description: 'Updated description',
    endpoint: 'https://agent.example.com',
    apiKey: 'new-secret-key',
  };

  const mockUpdatedProvider = {
    id: mockId,
    name: mockInput.name,
    description: mockInput.description,
    endpoint: mockInput.endpoint,
    apiKey: mockInput.apiKey,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates and returns the agent provider', async () => {
    (db.agentProvider.update as jest.Mock).mockResolvedValue(mockUpdatedProvider);

    const result = await updateAgentProvider(mockInput);

    expect(db.agentProvider.update).toHaveBeenCalledWith({
      where: { id: mockId },
      data: {
        name: mockInput.name,
        description: mockInput.description,
        endpoint: mockInput.endpoint,
        apiKey: mockInput.apiKey,
      },
    });
    expect(result).toEqual(mockUpdatedProvider);
  });

  it('stores null for apiKey when not provided', async () => {
    const providerWithoutKey = { ...mockUpdatedProvider, apiKey: null };
    (db.agentProvider.update as jest.Mock).mockResolvedValue(providerWithoutKey);

    const result = await updateAgentProvider({ ...mockInput, apiKey: null });

    expect(db.agentProvider.update).toHaveBeenCalledWith({
      where: { id: mockId },
      data: {
        name: mockInput.name,
        description: mockInput.description,
        endpoint: mockInput.endpoint,
        apiKey: null,
      },
    });
    expect(result.apiKey).toBeNull();
  });

  it('throws and logs when the db call fails', async () => {
    const dbError = new Error('DB connection failed');
    (db.agentProvider.update as jest.Mock).mockRejectedValue(dbError);

    await expect(updateAgentProvider(mockInput)).rejects.toThrow('Error updating agent provider');

    expect(logger.error).toHaveBeenCalledWith('Error updating agent provider', dbError);
  });
});
