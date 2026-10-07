import db from '@/server/db';
import isUserGroupMember from './isUserGroupMember';

jest.mock('@/server/db', () => ({
  userGroupMembership: {
    findUnique: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

describe('isUserGroupMember', () => {
  const userId = 'user-1';
  const userGroupId = 'group-1';

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when the membership exists', async () => {
    (db.userGroupMembership.findUnique as jest.Mock).mockResolvedValue({ userGroupId, userId, role: 'User' });

    const result = await isUserGroupMember(userId, userGroupId);

    expect(result).toBe(true);
    expect(db.userGroupMembership.findUnique).toHaveBeenCalledWith({
      where: { userGroupId_userId: { userGroupId, userId } },
    });
  });

  it('returns false when no membership exists', async () => {
    (db.userGroupMembership.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await isUserGroupMember(userId, userGroupId);

    expect(result).toBe(false);
  });

  it('throws if the membership lookup fails', async () => {
    (db.userGroupMembership.findUnique as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(isUserGroupMember(userId, userGroupId)).rejects.toThrow('Error checking user group membership');
  });
});
