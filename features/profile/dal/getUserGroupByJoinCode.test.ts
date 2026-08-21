import { getUserGroupByJoinCode } from './getUserGroupByJoinCode';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  userGroup: {
    findUnique: jest.fn(),
  },
}));

describe('getUserGroupByJoinCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return user group with member count when found', async () => {
    const joinCode = 'uh4T389e';
    const mockGroup = {
      id: 'a7d94520-d79d-4ade-81a2-db3605323a14',
      label: 'Test Group',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-02'),
      _count: { userGroupMemberships: 5 },
    };

    (db.userGroup.findUnique as jest.Mock).mockResolvedValue(mockGroup);

    const result = await getUserGroupByJoinCode(joinCode);

    expect(result).toEqual({
      id: mockGroup.id,
      label: mockGroup.label,
      createdAt: mockGroup.createdAt,
      updatedAt: mockGroup.updatedAt,
      memberCount: mockGroup._count.userGroupMemberships,
    });
    expect(db.userGroup.findUnique).toHaveBeenCalledWith({
      where: { joinCode },
      include: { _count: { select: { userGroupMemberships: true } } },
    });
  });

  it('should return null when no group is found', async () => {
    const joinCode = 'non-existent-join-code';

    (db.userGroup.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await getUserGroupByJoinCode(joinCode);

    expect(result).toBeNull();
    expect(db.userGroup.findUnique).toHaveBeenCalledWith({
      where: { joinCode },
      include: { _count: { select: { userGroupMemberships: true } } },
    });
  });

  it('should log an error and throw when database query fails', async () => {
    const joinCode = 'error-join-code';
    const error = new Error('Database error');

    (db.userGroup.findUnique as jest.Mock).mockRejectedValue(error);

    await expect(getUserGroupByJoinCode(joinCode)).rejects.toThrow(
      'Error finding user group by join code'
    );
    expect(logger.error).toHaveBeenCalledWith('Error finding user group by join code', error);
  });
});
