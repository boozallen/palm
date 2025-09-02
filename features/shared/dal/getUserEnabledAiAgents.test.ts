import getUserEnabledAiAgents from './getUserEnabledAiAgents';
import db from '@/server/db';
import logger from '@/server/logger';
import { AiAgent, AiAgentType } from '@/features/shared/types/ai-agent';

jest.mock('@/server/db', () => {
  return {
    aiAgent: {
      findMany: jest.fn(),
    },
  };
});

describe('getUserEnabledAiAgentsDal', () => {
  const userId = 'f6201669-0bef-4411-b264-cd39cfbc62df';

  const mockedResolvedValue: AiAgent[] = [
    {
      id: 'agent-1',
      label: 'Test Agent 1',
      description: 'First test agent',
      type: AiAgentType.CERTA, 
    },
    {
      id: 'agent-2',
      label: 'Test Agent 2',
      description: 'Second test agent',
      type: AiAgentType.RADAR,
    },
  ];
  const mockRejectedValue = new Error('Unable to fetch AI agents at this time. Please try again later');

  beforeEach(() => {
    jest.clearAllMocks();

    (db.aiAgent.findMany as jest.Mock).mockResolvedValue(mockedResolvedValue);
  });

  it('returns AI agents based on user groups', async () => {
    await getUserEnabledAiAgents(userId);

    expect(db.aiAgent.findMany).toHaveBeenCalledWith({
      where: {
        userGroups: {
          some: {
            userGroupMemberships: {
              some: {
                userId,
              },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        agentType: true,
      },
    });
  });

  it('returns empty array when no user group enabled agents exist', async () => {
    (db.aiAgent.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getUserEnabledAiAgents(userId);

    expect(result).toEqual([]);
  });

  it('throws an error if the DB query fails', async () => {
    (db.aiAgent.findMany as jest.Mock).mockRejectedValue(mockRejectedValue);

    await expect(getUserEnabledAiAgents(userId)).rejects.toThrow(new Error('Error fetching user enabled AI agents'));
    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching user enabled AI agents', mockRejectedValue
    );
  });
});
