import updateAiAgent from './updateAiAgent';
import db from '@/server/db';
import logger from '@/server/logger';
import { AiAgentType } from '@/features/shared/types/ai-agent';

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
    type: AiAgentType.CERTA, 
  };

  const mockDbResult = {
    id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
    name: 'Updated Agent',
    description: 'Updated Description',
    agentType: AiAgentType.CERTA, 
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (db.aiAgent.update as jest.Mock).mockResolvedValue(mockDbResult);
  });

  it('should update an AI agent', async () => {
    const result = await updateAiAgent(mockAgent);

    expect(db.aiAgent.update).toHaveBeenCalledWith({
      where: { id: mockAgent.id },
      data: {
        name: mockAgent.name,
        description: mockAgent.description,
      },
    });

    expect(result).toEqual({
      id: mockDbResult.id,
      label: mockDbResult.name,
      description: mockDbResult.description,
      type: mockDbResult.agentType,
    });
  });

  it('should handle database errors', async () => {
    const mockError = new Error('Database error');
    (db.aiAgent.update as jest.Mock).mockRejectedValue(mockError);

    await expect(updateAiAgent(mockAgent)).rejects.toThrow('Error updating AI Agent');
    expect(logger.error).toHaveBeenCalledWith(`Error updating AI Agent with id ${mockAgent.id}`, mockError);
  });
});
