import { buildUserScopeFilter } from './userScopeFilter';

jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    })),
    raw: jest.fn((value: string) => value),
    empty: Symbol('empty'),
  },
}));

type MockFragment = {
  strings: TemplateStringsArray;
  values: unknown[];
};

const isFragment = (value: unknown): value is MockFragment =>
  typeof value === 'object' && value !== null && 'strings' in value;

const render = (value: unknown): string => {
  if (isFragment(value)) {
    return value.strings
      .map((chunk, i) => chunk + (i < value.values.length ? render(value.values[i]) : ''))
      .join('');
  }
  if (typeof value === 'symbol') { return ''; }
  return String(value);
};

describe('buildUserScopeFilter', () => {
  const userGroupId = '123e4567-e89b-12d3-a456-426614174001';
  const userId = '123e4567-e89b-12d3-a456-426614174000';

  it('applies no filter when both userGroupId and userId are "all"', () => {
    const sql = render(buildUserScopeFilter('c."userId"', 'all', 'all'));

    expect(sql).not.toContain('c."userId"');
  });

  it('filters by group membership only when userId is "all"', () => {
    const sql = render(buildUserScopeFilter('c."userId"', userGroupId, 'all'));

    expect(sql).toContain('UserGroupMembership');
    expect(sql).toContain(userGroupId);
    expect(sql).not.toContain(`c."userId" = CAST(${userId}`);
  });

  it('filters by userId only when userGroupId is "all"', () => {
    const sql = render(buildUserScopeFilter('c."userId"', 'all', userId));

    expect(sql).toContain(`c."userId" = CAST(${userId} AS UUID)`);
    expect(sql).not.toContain('UserGroupMembership');
  });

  // Locks in the IDOR fix: a caller scoped to a specific group can no longer
  // reach a userId outside that group by ANDing rather than OR/else-ing the
  // two predicates against each other.
  it('ANDs userId and userGroupId together rather than treating userId as replacing the group filter', () => {
    const sql = render(buildUserScopeFilter('c."userId"', userGroupId, userId));

    expect(sql).toContain(`c."userId" = CAST(${userId} AS UUID)`);
    expect(sql).toContain('UserGroupMembership');
    expect(sql).toContain(userGroupId);
  });
});
