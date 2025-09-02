import db from '@/server/db';
import logger from '@/server/logger';
import getIsUserGroupLead from './getIsUserGroupLead';

jest.mock('@/server/db', () => ({
  userGroupMembership: {
    count: jest.fn(),
  },
}));

describe('getIsUserGroupLead', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return true if user is a lead', async () => {
    (db.userGroupMembership.count as jest.Mock).mockResolvedValue(1);

    const result = await getIsUserGroupLead('testUserId');
    expect(result).toBe(true);
  });

  it('should return false if user is not a lead', async () => {
    (db.userGroupMembership.count as jest.Mock).mockResolvedValue(0);

    const result = await getIsUserGroupLead('testUserId');
    expect(result).toBe(false);
  });

  it('should log an error and throw if there is a problem', async () => {
    (db.userGroupMembership.count as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(getIsUserGroupLead('testUserId')).rejects.toThrow('Error getting user group lead status');
    expect(logger.error).toHaveBeenCalledWith('Error getting user group lead status', new Error('DB error'));
  });
});
