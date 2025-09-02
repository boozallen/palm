import db from '@/server/db';
import getAiAgent from './getAiAgent';
import logger from '@/server/logger';
import { AiAgentType } from '@/features/shared/types/ai-agent';

jest.mock('@/server/db', () => ({
  aiAgent: {
    findUnique: jest.fn(),
  },
}));

describe('getAiAgent', () => {
  const mockAgentId = 'test-id';

  (db.aiAgent.findUnique as jest.Mock).mockResolvedValue({
    id: mockAgentId,
    name: 'Test Agent',
    description: 'This is a test agent.',
    agentType: AiAgentType.CERTA,
  });

  beforeEach(jest.clearAllMocks);

  it('should query database for AI agent', async () => {
    await getAiAgent(mockAgentId);

    expect(db.aiAgent.findUnique).toHaveBeenCalledWith({
      where: {
        id: mockAgentId,
      },
    });
  });

  it('should return AI agent data', async () => {
    const agent = await getAiAgent(mockAgentId);

    expect(agent).toEqual({
      id: mockAgentId,
      label: 'Test Agent',
      description: 'This is a test agent.',
      type: AiAgentType.CERTA,
    });
  });

  it('should throw an error if agent not found', async () => {
    (db.aiAgent.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(getAiAgent(mockAgentId)).rejects.toThrow();
  });

  it('should log a warning if agent not found', async () => {
    (db.aiAgent.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(getAiAgent(mockAgentId)).rejects.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), mockAgentId);
  });

  it('should throw an error if DB fails', async () => {
    (db.aiAgent.findUnique as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(getAiAgent(mockAgentId)).rejects.toThrow();
  });

  it('should log the error if DB fails', async () => {
    const mockError = new Error('DB error');
    (db.aiAgent.findUnique as jest.Mock).mockRejectedValue(mockError);

    await expect(getAiAgent(mockAgentId)).rejects.toThrow();
    expect(logger.error).toHaveBeenCalledWith(expect.any(String), mockError);
  });
});
