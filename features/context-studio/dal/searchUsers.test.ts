import db from '@/server/db';
import logger from '@/server/logger';
import searchUsers from './searchUsers';
import { TimeRange } from '@/features/context-studio/types/context-studio';

jest.mock('@prisma/client');
jest.mock('@/server/db', () => ({
  user: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $queryRaw: jest.fn(),
}));
jest.mock('@/server/logger');

describe('searchUsers', () => {
  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'User',
    lastLoginAt: new Date('2026-06-01'),
    _count: { userGroupMemberhip: 2 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (db.user.findMany as jest.Mock).mockResolvedValue([mockUser]);
    (db.user.count as jest.Mock).mockResolvedValue(1);
    (db.$queryRaw as jest.Mock).mockResolvedValue([
      { userId: 'user-1', spend: 12.34, tokens: 1200000 },
    ]);
  });

  it('should return paginated user results with spend and tokens', async () => {
    const result = await searchUsers({ page: 1, pageSize: 20, excludeAdmins: false, membershipStatus: 'all' });

    expect(result.records).toHaveLength(1);
    expect(result.totalCount).toBe(1);
    expect(result.records[0].id).toBe('user-1');
    expect(result.records[0].name).toBe('Test User');
    expect(result.records[0].groupCount).toBe(2);
    expect(result.records[0].spend).toBe(12.34);
    expect(result.records[0].tokens).toBe(1200000);
  });

  it('should default spend and tokens to zero when no usage rows exist', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValue([]);

    const result = await searchUsers({ page: 1, pageSize: 20, excludeAdmins: false, membershipStatus: 'all' });

    expect(result.records[0].spend).toBe(0);
    expect(result.records[0].tokens).toBe(0);
  });

  it('should apply name/email search filter', async () => {
    await searchUsers({ search: 'test', page: 1, pageSize: 20, excludeAdmins: false, membershipStatus: 'all' });

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: 'test', mode: 'insensitive' } },
            { email: { contains: 'test', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('should filter to members of at least one group', async () => {
    await searchUsers({ page: 1, pageSize: 20, excludeAdmins: false, membershipStatus: 'members' });

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userGroupMemberhip: { some: {} },
        }),
      }),
    );
  });

  it('should filter to non-members', async () => {
    await searchUsers({ page: 1, pageSize: 20, excludeAdmins: false, membershipStatus: 'nonMembers' });

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userGroupMemberhip: { none: {} },
        }),
      }),
    );
  });

  it('should filter by userGroupId when scoped to a group', async () => {
    await searchUsers({ userGroupId: 'group-123', page: 1, pageSize: 20, excludeAdmins: false, membershipStatus: 'all' });

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userGroupMemberhip: { some: { userGroupId: 'group-123' } },
        }),
      }),
    );
  });

  it('should filter by userId', async () => {
    await searchUsers({ userId: 'user-123', page: 1, pageSize: 20, excludeAdmins: false, membershipStatus: 'all' });

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'user-123',
        }),
      }),
    );
  });

  it('should not apply userId filter when value is all', async () => {
    await searchUsers({ userId: 'all', page: 1, pageSize: 20, excludeAdmins: false, membershipStatus: 'all' });

    const call = (db.user.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.id).toBeUndefined();
  });

  it('should exclude admins when flag is set', async () => {
    await searchUsers({ page: 1, pageSize: 20, excludeAdmins: true, membershipStatus: 'all' });

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: { not: 'Admin' },
        }),
      }),
    );
  });

  it('should match a week of login, creation, or audit activity', async () => {
    await searchUsers({ timeRange: TimeRange.Week, page: 1, pageSize: 20, excludeAdmins: false, membershipStatus: 'all' });

    const call = (db.user.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.AND[0].OR).toEqual([
      { lastLoginAt: { gte: expect.any(Date) } },
      { createdAt: { gte: expect.any(Date) } },
      { auditRecords: { some: { timestamp: { gte: expect.any(Date) } } } },
    ]);
  });

  // The window is resolved as a JS Date rather than SQL, so an unmapped preset
  // yields an Invalid Date rather than an error. `expect.any(Date)` accepts that,
  // hence the exact-value assertions here.
  describe('time range window bounds', () => {
    const NOW = new Date('2026-08-18T12:00:00.000Z');

    beforeEach(() => {
      jest.useFakeTimers({ now: NOW });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const capturedCutoff = (): Date => {
      const call = (db.user.findMany as jest.Mock).mock.calls[0][0];

      return call.where.AND[0].OR[0].lastLoginAt.gte;
    };

    it.each([
      [TimeRange.Day, '2026-08-17T12:00:00.000Z'],
      [TimeRange.Week, '2026-08-11T12:00:00.000Z'],
      [TimeRange.Month, '2026-07-19T12:00:00.000Z'],
      [TimeRange.Year, '2025-08-18T12:00:00.000Z'],
      [TimeRange.YearToDate, '2026-01-01T00:00:00.000Z'],
    ])('bounds %s at %s', async (timeRange, expected) => {
      await searchUsers({
        timeRange, page: 1, pageSize: 20, excludeAdmins: false, membershipStatus: 'all',
      });

      expect(capturedCutoff()).toEqual(new Date(expected));
    });

    it('applies the same cutoff to all three activity signals', async () => {
      await searchUsers({
        timeRange: TimeRange.Day, page: 1, pageSize: 20, excludeAdmins: false, membershipStatus: 'all',
      });

      const call = (db.user.findMany as jest.Mock).mock.calls[0][0];
      const cutoff = new Date('2026-08-17T12:00:00.000Z');

      expect(call.where.AND[0].OR).toEqual([
        { lastLoginAt: { gte: cutoff } },
        { createdAt: { gte: cutoff } },
        { auditRecords: { some: { timestamp: { gte: cutoff } } } },
      ]);
    });
  });

  it('should not apply timeRange filter for forever', async () => {
    await searchUsers({ timeRange: TimeRange.Forever, page: 1, pageSize: 20, excludeAdmins: false, membershipStatus: 'all' });

    const call = (db.user.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.AND).toBeUndefined();
    expect(call.where.lastLoginAt).toBeUndefined();
  });

  it('should keep the timeRange window when a search term is also applied', async () => {
    await searchUsers({ timeRange: TimeRange.Week, search: 'ada', page: 1, pageSize: 20, excludeAdmins: false, membershipStatus: 'all' });

    const call = (db.user.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.AND[0].OR).toHaveLength(3);
    expect(call.where.OR).toEqual([
      { name: { contains: 'ada', mode: 'insensitive' } },
      { email: { contains: 'ada', mode: 'insensitive' } },
    ]);
  });

  it('should handle null lastLoginAt', async () => {
    (db.user.findMany as jest.Mock).mockResolvedValue([
      { ...mockUser, lastLoginAt: null },
    ]);

    const result = await searchUsers({ page: 1, pageSize: 20, excludeAdmins: false, membershipStatus: 'all' });

    expect(result.records[0].lastLoginAt).toBeNull();
  });

  it('should handle pagination correctly', async () => {
    await searchUsers({ page: 3, pageSize: 5, excludeAdmins: false, membershipStatus: 'all' });

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 5,
      }),
    );
  });

  it('should not query spend when no users are returned', async () => {
    (db.user.findMany as jest.Mock).mockResolvedValue([]);
    (db.user.count as jest.Mock).mockResolvedValue(0);

    const result = await searchUsers({ page: 1, pageSize: 20, excludeAdmins: false, membershipStatus: 'all' });

    expect(result.records).toHaveLength(0);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it('should throw and log error on failure', async () => {
    const error = new Error('DB error');
    (db.user.findMany as jest.Mock).mockRejectedValue(error);

    await expect(searchUsers({ page: 1, pageSize: 20, excludeAdmins: false, membershipStatus: 'all' }))
      .rejects.toThrow('Unable to search users');

    expect(logger.error).toHaveBeenCalledWith('Failed to search users', error);
  });
});
