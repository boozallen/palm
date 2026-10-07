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

  // Per-action group attribution. When the caller names a column holding the
  // group the work was actually performed under, that column decides alone —
  // untagged rows are excluded rather than membership-matched. This is the
  // rule getUsageRecords/matchesUserGroup uses, shared so the two cannot drift.
  it('matches only the row\'s own group when a userGroupField is given, excluding untagged rows', () => {
    const sql = render(buildUserScopeFilter('apu."userId"', userGroupId, 'all', 'apu."userGroupId"'));

    expect(sql).toContain(`apu."userGroupId" = CAST(${userGroupId} AS UUID)`);
    expect(sql).not.toContain('IS NULL');
    expect(sql).not.toContain('EXISTS');
    expect(sql).not.toContain('UserGroupMembership');
  });

  // Without a userGroupField there is no per-row group to trust, so the predicate
  // must stay membership-only — the 12 other Context Studio DALs depend on it.
  it('stays membership-only when no userGroupField is given', () => {
    const sql = render(buildUserScopeFilter('c."userId"', userGroupId, 'all'));

    expect(sql).toContain('UserGroupMembership');
    expect(sql).not.toContain('IS NULL');
    expect(sql).not.toContain('EXISTS');
  });

  // A group-scoped caller must not be able to reach outside the group through
  // the attribution branch either, so the userId predicate still ANDs on top.
  it('still ANDs the userId predicate when a userGroupField is given', () => {
    const sql = render(buildUserScopeFilter('apu."userId"', userGroupId, userId, 'apu."userGroupId"'));

    expect(sql).toContain(`apu."userId" = CAST(${userId} AS UUID)`);
    expect(sql).toContain(`apu."userGroupId" = CAST(${userGroupId} AS UUID)`);
  });

  it('leaves untagged rows in when no group is selected and excludeUnattributed is not set', () => {
    const sql = render(buildUserScopeFilter('apu."userId"', 'all', 'all', 'apu."userGroupId"'));

    expect(sql).not.toContain('IS NOT NULL');
  });

  // The consolidated form of the "all"-scope exclusion every raw AiProviderUsage
  // query used to hand-copy; one call site to keep them all in agreement.
  it('drops untagged rows when no group is selected and excludeUnattributed is set', () => {
    const sql = render(buildUserScopeFilter('apu."userId"', 'all', 'all', 'apu."userGroupId"', true));

    expect(sql).toContain('apu."userGroupId" IS NOT NULL');
  });

  // The null-check must come from the caller's own userGroupField rather than a
  // hardcoded "apu" alias, so callers that alias the table differently
  // (e.g. "c", "we") still get valid, correctly-scoped SQL.
  it('drops untagged rows using the caller\'s own userGroupField alias, not a hardcoded one', () => {
    const sql = render(buildUserScopeFilter('c."userId"', 'all', 'all', 'c."userGroupId"', true));

    expect(sql).toContain('c."userGroupId" IS NOT NULL');
    expect(sql).not.toContain('apu.');
  });

  // excludeUnattributed only applies to the "no group selected" branch; a
  // specific group already matches only that group's own tagged rows.
  it('ignores excludeUnattributed when a specific group is selected', () => {
    const sql = render(buildUserScopeFilter('apu."userId"', userGroupId, 'all', 'apu."userGroupId"', true));

    expect(sql).not.toContain('IS NOT NULL');
    expect(sql).toContain(`apu."userGroupId" = CAST(${userGroupId} AS UUID)`);
  });
});
