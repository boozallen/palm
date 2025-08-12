import getUserGroups from './getUserGroups';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  userGroupMembership: {
    findMany: jest.fn(),
  },
}));

const userId = 'cdd84b22-1bfd-4575-9c31-6347bc07e643';

describe('getUserGroups DAL', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should query and reshape the response', async () => {
    const mockMembershipOne = { userGroup: { id: 'afa7fa27-cdba-4686-976e-8da06565d367', label: 'label1' }, role: 'User', userId };
    const mockMembershipTwo = { userGroup: { id: '8f04ea7b-c489-4372-9652-ea455a2f9a55', label: 'label2' }, role: 'Lead', userId };
    (db.userGroupMembership.findMany as jest.Mock).mockResolvedValue([
      mockMembershipOne,
      mockMembershipTwo,
    ]);
    const result = await getUserGroups(userId);
    expect(db.userGroupMembership.findMany).toHaveBeenCalledWith({
      include: { userGroup: true },
      where: { userId },
    });
    expect(result).toEqual([
      { id: mockMembershipOne.userGroup.id, label: mockMembershipOne.userGroup.label, role: mockMembershipOne.role },
      { id: mockMembershipTwo.userGroup.id, label: mockMembershipTwo.userGroup.label, role: mockMembershipTwo.role },
    ]);
  });

  it('throws an error if the retrieval fails', async () => {
    const mockError = new Error('Database error');
    (db.userGroupMembership.findMany as jest.Mock).mockRejectedValue(mockError);

    await expect(getUserGroups(userId)).rejects.toThrow('Error getting user group memberships');
  });
});
