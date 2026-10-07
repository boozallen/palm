import { Prisma } from '@prisma/client';

// Matches usage rows explicitly tagged with the group, rather than a user's current
// membership, since membership doesn't reflect which group the usage occurred under.
export function excludeUnattributedUsage(): Prisma.Sql {
  return Prisma.sql`"apu"."userGroupId" IS NOT NULL`;
}

// `userGroupField` is a pre-quoted column reference (e.g. `"apu"."userGroupId"`) inserted
// with Prisma.raw, so callers must never pass user input here. Shared with
// buildUserScopeFilter (features/context-studio/dal/userScopeFilter.ts) so the "match
// the tagged group, not membership" rule has one implementation.
export function matchesUserGroup(userGroupField: string, userGroupId: string): Prisma.Sql {
  return Prisma.sql`${Prisma.raw(userGroupField)} = CAST(${userGroupId} AS UUID)`;
}
