import db from '@/server/db';
import logger from '@/server/logger';
import { UserGroupRole } from '@/features/shared/types/user-group';
import getStudioUserGroups from './getStudioUserGroups';

jest.mock('@prisma/client');
jest.mock('@/server/db', () => ({
  userGroup: {
    findMany: jest.fn(),
  },
}));
jest.mock('@/server/logger');

describe('getStudioUserGroups', () => {
  const groups = [
    { id: 'group-1', label: 'Default', userGroupMemberships: [{ role: UserGroupRole.User }] },
    { id: 'group-2', label: 'Admin Group', userGroupMemberships: [{ role: UserGroupRole.Lead }] },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (db.userGroup.findMany as jest.Mock).mockResolvedValue(groups);
  });

  it('returns the id, label, and Lead status of each group', async () => {
    const result = await getStudioUserGroups('user-1', false);

    expect(result).toEqual([
      { id: 'group-1', label: 'Default', isLead: false },
      { id: 'group-2', label: 'Admin Group', isLead: true },
    ]);
  });

  // An Admin already sees every group's data elsewhere in the studio, so the
  // filter list is unrestricted, and every group is flagged led, for them.
  // The membership lookup only exists to compute isLead for a non-Admin, so
  // an Admin's query skips it rather than joining and discarding the result.
  it('does not filter the list, skips the membership join, and flags every group led for an Admin', async () => {
    (db.userGroup.findMany as jest.Mock).mockResolvedValue([
      { id: 'group-1', label: 'Default' },
      { id: 'group-2', label: 'Admin Group' },
    ]);

    const result = await getStudioUserGroups('user-1', true);

    expect(db.userGroup.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      select: { id: true, label: true },
      orderBy: { label: 'asc' },
    });
    expect(result).toEqual([
      { id: 'group-1', label: 'Default', isLead: true },
      { id: 'group-2', label: 'Admin Group', isLead: true },
    ]);
  });

  // Without this a member of one group could enumerate every group in the org
  // through the filter dropdown.
  it('limits a non-Admin to their own groups that have the studio enabled', async () => {
    await getStudioUserGroups('user-1', false);

    expect(db.userGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          contextStudioEnabled: true,
          userGroupMemberships: { some: { userId: 'user-1' } },
        },
      }),
    );
  });

  // isLead reflects this specific membership row, not any org-wide Lead status.
  it('flags a group as led only when the viewer is a Lead of that group', async () => {
    (db.userGroup.findMany as jest.Mock).mockResolvedValue([
      { id: 'group-1', label: 'Default', userGroupMemberships: [] },
    ]);

    const result = await getStudioUserGroups('user-1', false);

    expect(result).toEqual([{ id: 'group-1', label: 'Default', isLead: false }]);
  });

  it('throws a sanitized error and logs the cause when the query fails', async () => {
    (db.userGroup.findMany as jest.Mock).mockRejectedValue(new Error('connection refused'));

    await expect(getStudioUserGroups('user-1', false)).rejects.toThrow(
      'Error getting Context Studio user groups',
    );
    expect(logger.error).toHaveBeenCalled();
  });
});
