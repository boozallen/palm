import getAvailableAgents from './getAvailableAgents';
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

describe('getAvailableAgents', () => {
  const userId = 'f6201669-0bef-4411-b264-cd39cfbc62df';

  const mockDatabaseResponse  = [
    {
      id: '884f673e-6da3-4d40-8436-ad48bf1b4bce',
      name: 'Test Agent 1',
      description: 'Description for test agent 1',
      agentType: AiAgentType.CERTA,

    },
    {
      id: '041222c4-30e7-457f-9386-83665b3ddc93',
      name: 'Test Agent 2',
      description: 'Description for test agent 2',
      agentType: AiAgentType.RADAR,
    },
  ];

  const expectedResult = [
    {
      id: '884f673e-6da3-4d40-8436-ad48bf1b4bce',
      label: 'Test Agent 1',
      description: 'Description for test agent 1',
      type: AiAgentType.CERTA,
    },
    {
      id: '041222c4-30e7-457f-9386-83665b3ddc93',
      label: 'Test Agent 2',
      description: 'Description for test agent 2',
      type: AiAgentType.RADAR,
    },
  ];

  const mockError = new Error(
    'Unable to fetch agents at this time. Please try again later'
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (db.aiAgent.findMany as jest.Mock).mockResolvedValue(mockDatabaseResponse);
  });

  it('returns agents based on user groups', async () => {
    const result = await getAvailableAgents(userId);

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

    expect(result).toEqual(expectedResult);
    expect(result.length).toBe(2);
    expect(result[0].id).toBe('884f673e-6da3-4d40-8436-ad48bf1b4bce');
    expect(result[1].id).toBe('041222c4-30e7-457f-9386-83665b3ddc93');
  });

  it('throws an error if the DB query fails', async () => {
    (db.aiAgent.findMany as jest.Mock).mockRejectedValue(mockError);

    await expect(getAvailableAgents(userId)).rejects.toThrow(
      new Error('Error fetching available agents')
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching available agents',
      mockError
    );
  });
});
