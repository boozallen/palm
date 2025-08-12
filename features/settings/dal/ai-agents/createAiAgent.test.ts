import db from '@/server/db';
import createAiAgent from './createAiAgent';
import logger from '@/server/logger';
import { AiAgentType } from '@/features/shared/types/ai-agent';

jest.mock('@/server/db', () => ({
  aiAgent: {
    create: jest.fn(),
  },
}));

const mockResolvedValue = {
  id: 'd8283f19-fc06-40d2-ab82-52f7f02f2025',
  name: 'Test Ai Agent',
  description: 'This is a test AI agent',
  agentType: AiAgentType.CERTA,
};

const input = {
  name: mockResolvedValue.name,
  description: mockResolvedValue.description,
  type: mockResolvedValue.agentType,
};

describe('createAiAgent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    expect(db.aiAgent.create).toHaveBeenCalledWith({
      data: {
        name: input.name,
        description: input.description,
        agentType: input.type,
      },
    });
  });

  it('creates AI agent successfully', async () => {
    (db.aiAgent.create as jest.Mock).mockResolvedValue(mockResolvedValue);

    const response = await createAiAgent(input);

    expect(response).toEqual({
      id: mockResolvedValue.id,
      name: mockResolvedValue.name,
      description: mockResolvedValue.description,
      type: mockResolvedValue.agentType,
    });
  });

  it('handles errors successfully', async () => {
    const error = new Error('Error creating AI agent');
    (db.aiAgent.create as jest.Mock).mockRejectedValue(error);

    await expect(createAiAgent(input)).rejects.toThrow(
      'Error creating AI agent'
    );

    expect(logger.error).toHaveBeenCalledWith('Error creating AI agent', error);
  });
});
