import db from '@/server/db';
import getUserGroupMemberships from './getUserGroupMemberships';
import { UserGroupRole } from '@/features/shared/types/user-group';

// Explicit stub rather than an automock: matchesUserGroup composes the query through
// Prisma.sql, and the real @prisma/client resolves to its browser build under this
// project's jsdom test environment unless it's mocked.
jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
      sql: strings.join('?'),
    })),
    raw: jest.fn((value: string) => value),
  },
}));

jest.mock('@/server/db', () => ({
  userGroupMembership: {
    findMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
}));

describe('getUserGroupMemberships', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (db.userGroupMembership.findMany as jest.Mock).mockResolvedValue([]);
    (db.$queryRaw as jest.Mock).mockResolvedValue([]);
  });

  it('should return user group memberships successfully', async () => {
    const userGroupIdOne = 'test1-id';

    (db.userGroupMembership.findMany as jest.Mock).mockReturnValue([{
      userGroupId: userGroupIdOne,
      userId: 'user1',
      user: {
        name: 'User 1',
        email: 'user1@gmail.com',
        lastLoginAt: new Date(),
      },
      role: UserGroupRole.Lead,
    }, {
      userGroupId: userGroupIdOne,
      userId: 'user3',
      user: {
        name: 'User 3',
        email: 'user3@gmail.com',
        lastLoginAt: new Date(),
      },
      role: UserGroupRole.User,
    }]);

    (db.$queryRaw as jest.Mock).mockResolvedValue([
      {
        userId: 'user1',
        cost: 12.5,
        inputTokens: 1500,
        outputTokens: 250,
        monthlyCost: 5,
        monthlyInputTokens: 600,
        monthlyOutputTokens: 100,
      },
    ]);

    const result = await getUserGroupMemberships(userGroupIdOne);

    expect(result).toEqual([{
      userGroupId: userGroupIdOne,
      userId: 'user1',
      name: 'User 1',
      role: UserGroupRole.Lead,
      email: 'user1@gmail.com',
      lastLoginAt: expect.any(Date),
      cost: 12.5,
      inputTokens: 1500,
      outputTokens: 250,
      monthlyCost: 5,
      monthlyInputTokens: 600,
      monthlyOutputTokens: 100,
    }, {
      userGroupId: userGroupIdOne,
      userId: 'user3',
      name: 'User 3',
      role: UserGroupRole.User,
      email: 'user3@gmail.com',
      lastLoginAt: expect.any(Date),
      cost: 0,
      inputTokens: 0,
      outputTokens: 0,
      monthlyCost: 0,
      monthlyInputTokens: 0,
      monthlyOutputTokens: 0,
    }]);
    expect(db.userGroupMembership.findMany).toHaveBeenCalledWith({
      where: { userGroupId: userGroupIdOne },
      include: { user: true },
    });
    expect(db.$queryRaw).toHaveBeenCalled();
  });

  it('should throw an error if the operation fails', async () => {
    (db.userGroupMembership.findMany as jest.Mock).mockRejectedValue(new Error('DB down'));

    await expect(getUserGroupMemberships('test1-id')).rejects.toThrow('Error getting user group memberships');
  });

  it('matches only usage explicitly tagged with the group, excluding untagged legacy rows', async () => {
    await getUserGroupMemberships('test1-id');

    // Recurses on strings/values rather than the mock's eagerly-joined `.sql` field,
    // since a raw column name (via Prisma.raw) comes through as a plain string value
    // rather than a nested fragment, and `.sql` alone would render it as a bare '?'.
    const flattenSql = (strings: readonly string[], values: unknown[]): string =>
      strings.reduce((acc, part, i) => {
        const value = values[i] as { strings?: readonly string[]; values?: unknown[] } | undefined;
        const nested = value?.strings
          ? flattenSql(value.strings, value.values ?? [])
          : (value !== undefined ? String(value) : '');
        return acc + part + nested;
      }, '');
    const [strings, ...values] = (db.$queryRaw as jest.Mock).mock.calls[0] as [readonly string[], ...unknown[]];
    const text = flattenSql(strings, values);

    expect(text).toContain('"apu"."userGroupId" =');
    // Untagged (legacy/unattributed) rows are excluded rather than membership-matched —
    // membership reflects current groups, not which group the usage actually occurred in.
    expect(text).not.toContain('"apu"."userGroupId" IS NULL');
    expect(text).not.toContain('EXISTS');
    expect(text).not.toContain('"UserGroupMembership"');
  });
});
