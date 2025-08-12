import getAiAgents from './getAiAgents';
import db from '@/server/db';
import logger from '@/server/logger';
import { AiAgentType } from '@/features/shared/types/ai-agent';

jest.mock('@/server/db', () => {
  return {
    aiAgent: {
      findMany: jest.fn(),
    },
  };
});

describe('getAiAgents', () => {
  const mockedResolvedValue = [
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
      name: 'Agent 1',
      description: 'Description 1',
      agentType: AiAgentType.CERTA,
    },
    {
      id: '20e0eba0-b782-491b-b609-b5c84cb0e17a',
      name: 'Agent 2',
      description: 'Description 2',
      agentType: AiAgentType.RADAR,
    },
  ];

  const mockRejectedValue = new Error('Unable to fetch ai agents at this time. Please try again later');

  beforeEach(() => {
    jest.clearAllMocks();
    (db.aiAgent.findMany as jest.Mock).mockResolvedValue(mockedResolvedValue);
  });

  it('returns AI Agents from the database', async () => {
    const aiAgents = await getAiAgents();

    expect(db.aiAgent.findMany).toHaveBeenCalled();

    expect(aiAgents).toEqual(mockedResolvedValue.map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      type: agent.agentType,
    })));
  });

  it('throws an error if the DB query fails', async () => {
    (db.aiAgent.findMany as jest.Mock).mockRejectedValue(mockRejectedValue);

    await expect(getAiAgents()).rejects.toThrow(new Error('Error fetching AI Agents'));
    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching AI Agents', mockRejectedValue
    );
  });

  it('returns an empty array if no agents are found', async () => {
    (db.aiAgent.findMany as jest.Mock).mockResolvedValue([]);

    const aiAgents = await getAiAgents();
    expect(aiAgents).toEqual([]);
  });
});
