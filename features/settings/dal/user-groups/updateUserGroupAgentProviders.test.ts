import updateUserGroupAgentProviders from './updateUserGroupAgentProviders';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  userGroup: {
    update: jest.fn(),
  },
}));

describe('updateUserGroupAgentProviders', () => {
  const mockUserGroupId = 'test-group-id-1';
  const mockAgentProviderId = 'test-provider-id-1';

  const mockAgentProviders = [
    {
      id: mockAgentProviderId,
      name: 'Test Agent',
      description: 'A test agent',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('connects an agent provider when enabled is true', async () => {
    (db.userGroup.update as jest.Mock).mockResolvedValue({
      id: mockUserGroupId,
      agentProviders: mockAgentProviders,
    });

    const result = await updateUserGroupAgentProviders({
      userGroupId: mockUserGroupId,
      agentProviderId: mockAgentProviderId,
      enabled: true,
    });

    expect(db.userGroup.update).toHaveBeenCalledWith({
      where: { id: mockUserGroupId, deletedAt: null },
      data: {
        agentProviders: {
          connect: { id: mockAgentProviderId },
        },
      },
      include: {
        agentProviders: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    expect(result).toEqual(
      mockAgentProviders.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }))
    );
  });

  it('disconnects an agent provider when enabled is false', async () => {
    (db.userGroup.update as jest.Mock).mockResolvedValue({
      id: mockUserGroupId,
      agentProviders: [],
    });

    await updateUserGroupAgentProviders({
      userGroupId: mockUserGroupId,
      agentProviderId: mockAgentProviderId,
      enabled: false,
    });

    expect(db.userGroup.update).toHaveBeenCalledWith({
      where: { id: mockUserGroupId, deletedAt: null },
      data: {
        agentProviders: {
          disconnect: { id: mockAgentProviderId },
        },
      },
      include: {
        agentProviders: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  });

  it('throws and logs when the db call fails', async () => {
    const dbError = new Error('DB connection failed');
    (db.userGroup.update as jest.Mock).mockRejectedValue(dbError);

    await expect(
      updateUserGroupAgentProviders({
        userGroupId: mockUserGroupId,
        agentProviderId: mockAgentProviderId,
        enabled: true,
      })
    ).rejects.toThrow('Error updating user group agent providers');

    expect(logger.error).toHaveBeenCalledWith('Error updating user group agent providers', dbError);
  });
});
