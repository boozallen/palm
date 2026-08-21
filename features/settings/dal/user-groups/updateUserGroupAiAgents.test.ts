import db from '@/server/db';
import updateUserGroupAiAgents from '@/features/settings/dal/user-groups/updateUserGroupAiAgents';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  userGroup: {
    update: jest.fn(),
  },
}));

describe('updateUserGroupAiAgents DAL', () => {

  const mockError = 'Error updating the user group\'s AI Agents';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should connect an AI Agent to a user group when enabled is true', async () => {
    const updatedUserGroup = {
      id: '1',
      aiAgents: [{ id: 'ai1' }],
    };

    (db.userGroup.update as jest.Mock).mockResolvedValue(updatedUserGroup);
    const mockProvider = { id: 'ai1' };

    const input = {
      userGroupId: '1',
      aiAgentId: 'ai1',
      enabled: true,
    };

    const result = await updateUserGroupAiAgents(input);

    expect(db.userGroup.update).toHaveBeenCalledWith({
      where: { id: input.userGroupId },
      data: {
        aiAgents: {
          connect: { id: 'ai1' },
        },
      },
      select: {
        aiAgents: true,
      },
    });

    expect(result).toEqual([mockProvider]);
  });

  it('should disconnect an AI Agent from a user group when enabled is false', async () => {
    const updatedUserGroup = {
      id: '1',
      aiAgents: [],
    };

    (db.userGroup.update as jest.Mock).mockResolvedValue(updatedUserGroup);

    const input = {
      userGroupId: '1',
      aiAgentId: 'ai1',
      enabled: false,
    };

    const result = await updateUserGroupAiAgents(input);

    expect(db.userGroup.update).toHaveBeenCalledWith({
      where: { id: input.userGroupId },
      data: {
        aiAgents: {
          disconnect: { id: 'ai1' },
        },
      },
      select: {
        aiAgents: true,
      },
    });

    expect(result).toEqual([]);
  });

  it('should throw an error if the operation fails', async () => {
    const operationFailedError = new Error('Problem updating the user group\'s AI Agents');
    (db.userGroup.update as jest.Mock).mockRejectedValue(operationFailedError);

    const input = {
      userGroupId: '1',
      aiAgentId: 'ai1',
      enabled: true,
    };

    await expect(updateUserGroupAiAgents(input)).rejects.toThrow(mockError);
    expect(logger.error).toHaveBeenCalledWith(mockError, operationFailedError);
  });
});
