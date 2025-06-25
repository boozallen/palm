import db from '@/server/db';
import getUserGroupMembership from './getUserGroupMembership';
import { UserGroupRole } from '@/features/shared/types/user-group';

jest.mock('@/server/db', () => ({
  userGroupMembership: {
    findUnique: jest.fn(),
  },
}));

describe('getUserGroupMembershipRole', () => {
  it('should return the user group membership role', async () => {
    const userId = 'testUserId';
    const userGroupId = 'testUserGroupId';
    const mockRole = UserGroupRole.Lead;

    (db.userGroupMembership.findUnique as jest.Mock).mockResolvedValue({
      userGroupId,
      userId,
      role: mockRole,
    });

    const result = await getUserGroupMembership(userId, userGroupId);

    expect(result).toEqual({ userGroupId, userId, role: mockRole });
    expect(db.userGroupMembership.findUnique).toBeCalled();
  });
  it('should throw an error if the user group membership role is not found', async () => {
    const userId = 'testUserId';
    const userGroupId = 'testUserGroupId';

    (db.userGroupMembership.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(getUserGroupMembership(userId, userGroupId)).resolves.toBe(
      null,
    );
    expect(db.userGroupMembership.findUnique).toBeCalled();
  });
});
