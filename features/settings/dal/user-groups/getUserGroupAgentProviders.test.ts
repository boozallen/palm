import getUserGroupAgentProviders from './getUserGroupAgentProviders';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  userGroup: {
    findUnique: jest.fn(),
  },
}));

describe('getUserGroupAgentProviders', () => {
  const mockUserGroupId = 'test-group-id-1';

  const mockAgentProviders = [
    {
      id: 'test-provider-id-1',
      name: 'Agent One',
      description: 'First agent',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns agent providers for the user group', async () => {
    (db.userGroup.findUnique as jest.Mock).mockResolvedValue({
      id: mockUserGroupId,
      agentProviders: mockAgentProviders,
    });

    const result = await getUserGroupAgentProviders(mockUserGroupId);

    expect(db.userGroup.findUnique).toHaveBeenCalledWith({
      where: { id: mockUserGroupId, deletedAt: null },
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

  it('returns an empty array when the group has no agent providers', async () => {
    (db.userGroup.findUnique as jest.Mock).mockResolvedValue({
      id: mockUserGroupId,
      agentProviders: [],
    });

    const result = await getUserGroupAgentProviders(mockUserGroupId);
    expect(result).toEqual([]);
  });

  it('throws when the user group is not found', async () => {
    (db.userGroup.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(getUserGroupAgentProviders(mockUserGroupId)).rejects.toThrow('User group not found');
  });

  it('throws and logs when the db call fails', async () => {
    const dbError = new Error('DB connection failed');
    (db.userGroup.findUnique as jest.Mock).mockRejectedValue(dbError);

    await expect(getUserGroupAgentProviders(mockUserGroupId)).rejects.toThrow('DB connection failed');

    expect(logger.error).toHaveBeenCalledWith('Error fetching user group agent providers', dbError);
  });
});
