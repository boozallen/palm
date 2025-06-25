import updateAiAgent from './updateAiAgent';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  aiAgent: {
    update: jest.fn(),
  },
}));

describe('updateAiAgent', () => {
  const mockAgent = {
    id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
    name: 'Agent 1',
    description: 'Description 1',
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (db.aiAgent.update as jest.Mock).mockResolvedValue(mockAgent);
  });

  it('should update an AI agent', async () => {
    const result = await updateAiAgent(mockAgent.id, false);

    expect(db.aiAgent.update).toHaveBeenCalledWith({
      where: { id: mockAgent.id },
      data: { enabled: false },
    });

    expect(result).toEqual({
      id: mockAgent.id,
      name: mockAgent.name,
      description: mockAgent.description,
      enabled: mockAgent.enabled,
    });
  });

  it('should handle database errors', async () => {
    const mockError = new Error('Database error');
    (db.aiAgent.update as jest.Mock).mockRejectedValue(mockError);

    await expect(updateAiAgent(mockAgent.id, true)).rejects.toThrow('Error updating AI Agent');
    expect(logger.error).toHaveBeenCalledWith(`Error updating AI Agent with id ${mockAgent.id}`, mockError);
  });
});
