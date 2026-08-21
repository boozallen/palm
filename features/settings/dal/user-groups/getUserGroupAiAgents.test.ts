import getUserGroupAiAgents from './getUserGroupAiAgents';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  userGroup: {
    findUniqueOrThrow: jest.fn(),
  },
}));

describe('getUserGroupAiAgents', () => {
  const mockId = '123e4567-e89b-12d3-a456-426614174000';
  const mockAgents = [
    {
      id: 'a23e4567-e89b-12d3-a456-426614174001',
      name: 'Agent 1',
      description: 'Description 1',
    },
    {
      id: 'b23e4567-e89b-12d3-a456-426614174002',
      name: 'Agent 2',
      description: 'Description 2',
    },
    {
      id: 'c23e4567-e89b-12d3-a456-426614174003',
      name: 'Agent 3',
      description: 'Description 3',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (db.userGroup.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      aiAgents: mockAgents,
    });
  });

  it('should return agents associated with the user group', async () => {
    const result = await getUserGroupAiAgents(mockId);

    expect(db.userGroup.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: mockId },
      select: { aiAgents: true },
    });

    expect(result).toEqual(mockAgents.map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
    })));
  });

  it('throws an error if the DB query fails', async () => {
    const mockError = new Error('DB error');
    (db.userGroup.findUniqueOrThrow as jest.Mock).mockRejectedValue(mockError);

    await expect(getUserGroupAiAgents(mockId)).rejects.toThrow('Error getting user group AI agents');
    expect(logger.error).toHaveBeenCalledWith('Error getting user group AI agents', mockError);
  });

  it('returns an empty array if no agents are associated with the user group', async () => {
    (db.userGroup.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      aiAgents: [],
    });

    const result = await getUserGroupAiAgents(mockId);
    expect(result).toEqual([]);
  });
});
