/**
 * @jest-environment node
 */
// The real @prisma/client resolves to its browser build under this project's default
// jsdom test environment, so this file runs under node to exercise Prisma.sql directly.
import { excludeUnattributedUsage, matchesUserGroup } from './aiProviderUsageAttribution';

describe('excludeUnattributedUsage', () => {
  it('produces a fragment that excludes rows with no user group attributed', () => {
    expect(excludeUnattributedUsage().sql).toBe('"apu"."userGroupId" IS NOT NULL');
  });
});

describe('matchesUserGroup', () => {
  it('produces a fragment that matches usage tagged with the given group', () => {
    const fragment = matchesUserGroup('"apu"."userGroupId"', '6de3d2d5-1918-4288-993a-7445a2c8dbf9');

    expect(fragment.sql).toBe('"apu"."userGroupId" = CAST(? AS UUID)');
    expect(fragment.values).toEqual(['6de3d2d5-1918-4288-993a-7445a2c8dbf9']);
  });

  it('uses whichever group column the caller names', () => {
    const fragment = matchesUserGroup('"c"."userGroupId"', '6de3d2d5-1918-4288-993a-7445a2c8dbf9');

    expect(fragment.sql).toBe('"c"."userGroupId" = CAST(? AS UUID)');
  });
});
