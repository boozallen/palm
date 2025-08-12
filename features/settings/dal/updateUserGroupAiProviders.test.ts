import db from '@/server/db';
import updateUserGroupAiProviders from '@/features/settings/dal/updateUserGroupAiProviders';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  userGroup: {
    update: jest.fn(),
  },
}));

jest.mock('@/features/shared/dal/buildProvider', () => jest.fn());

describe('updateUserGroupAiProviders DAL', () => {

  const mockError = 'Error updating the user group\'s AiProviders';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should connect an AiProvider to a user group when enabled == TRUE', async () => {
    const updatedUserGroup = {
      id: '1',
      aiProviders: [{ id: 'ai1' }],
    };

    (db.userGroup.update as jest.Mock).mockResolvedValue(updatedUserGroup);
    const mockProvider = { id: 'ai1' };
    const buildProvider = require('@/features/shared/dal/buildProvider');
    buildProvider.mockResolvedValue(mockProvider);

    const input = {
      userGroupId: '1',
      aiProviderId: 'ai1',
      enabled: true,
    };

    const result = await updateUserGroupAiProviders(input);

    expect(db.userGroup.update).toHaveBeenCalledWith({
      where: { id: input.userGroupId },
      data: {
        aiProviders: {
          connect: { id: 'ai1' },
        },
      },
      select: {
        aiProviders: true,
      },
    });

    expect(buildProvider).toHaveBeenCalledWith(db, updatedUserGroup.aiProviders[0]);
    expect(result).toEqual([mockProvider]);
  });

  it('should disconnect an AiProvider from a user group when enabled == FALSE', async () => {
    const updatedUserGroup = {
      id: '1',
      aiProviders: [],
    };

    (db.userGroup.update as jest.Mock).mockResolvedValue(updatedUserGroup);
    const buildProvider = require('@/features/shared/dal/buildProvider');

    const input = {
      userGroupId: '1',
      aiProviderId: 'ai1',
      enabled: false,
    };

    const result = await updateUserGroupAiProviders(input);

    expect(db.userGroup.update).toHaveBeenCalledWith({
      where: { id: input.userGroupId },
      data: {
        aiProviders: {
          disconnect: { id: 'ai1' },
        },
      },
      select: {
        aiProviders: true,
      },
    });

    expect(buildProvider).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('should throw an error if the operation fails', async () => {
    const operationFailedError = new Error('Problem updating the user group\'s AiProviders');
    (db.userGroup.update as jest.Mock).mockRejectedValue(operationFailedError);

    const input = {
      userGroupId: '1',
      aiProviderId: 'ai1',
      enabled: true,
    };

    await expect(updateUserGroupAiProviders(input)).rejects.toThrow(mockError);
    expect(logger.error).toHaveBeenCalledWith(mockError, operationFailedError);
  });
});
