import db from '@/server/db';
import deleteAiAgent from './deleteAiAgent';
import { AiAgentType } from '@/features/shared/types';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  aiAgent: {
    delete: jest.fn(),
  },
}));

describe('deleteAiAgent', () => {

  const mockId = 'd92fda33-fb15-4ea0-8bfa-df8f963394fb';
  const mockResponse = {
    id: mockId,
    name: 'Test Agent',
    description: 'This is a test agent',
    agentType: AiAgentType.CERTA,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (db.aiAgent.delete as jest.Mock).mockResolvedValue(mockResponse);
  });

  it('should query the agent table using the agentId', async () => {
    await deleteAiAgent(mockId);
    expect(db.aiAgent.delete).toHaveBeenCalledWith({
      where: {
        id: mockId,
      },
    });
  });

  it('should return the deleted agent', async () => {
    const result = await deleteAiAgent(mockId);

    expect(result).toEqual({
      id: mockResponse.id,
      label: mockResponse.name,
      description: mockResponse.description,
      type: mockResponse.agentType,
    });
  });

  it('should throw a sanitized error message on failure', async () => {
    const errorMessage = 'Failed to delete AI agent';
    (db.aiAgent.delete as jest.Mock).mockRejectedValue(new Error(errorMessage));

    await expect(deleteAiAgent(mockId)).rejects.toThrow(errorMessage);
  });

  it('should log an error message on failure', async () => {
    const errorMessage = 'Failed to delete AI agent';
    (db.aiAgent.delete as jest.Mock).mockRejectedValue(new Error(errorMessage));

    await expect(deleteAiAgent(mockId)).rejects.toThrow(errorMessage);
    expect(logger.error).toHaveBeenCalledWith('Error deleting AI agent: ', new Error(errorMessage));
  });
});
