import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getUserGroupMemberships from '@/features/settings/dal/user-groups/getUserGroupMemberships';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const inputSchema = z.object({
  userGroupId: z.string().uuid(),
});

// Only what the User filter needs to render an option. The underlying DAL also
// returns email and last-login, which have no business in a dropdown.
const outputSchema = z.object({
  members: z.array(
    z.object({
      userId: z.string().uuid(),
      name: z.string(),
    })
  ),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ ctx, input }) => {
    // Checked against the same list that populates the group dropdown, so a
    // group hidden from the filter cannot have its members read by id.
    const { isLead } = await scopeStudioQuery(ctx, input.userGroupId, 'all');

    const memberships = await getUserGroupMemberships(input.userGroupId);

    // A plain member may only ever filter cost/usage down to themselves, so the
    // roster only needs to offer their own name; only Admins and the group's own
    // Leads get the full member list.
    const visibleMemberships = isLead
      ? memberships
      : memberships.filter((membership) => membership.userId === ctx.userId);

    return {
      members: visibleMemberships.map((membership) => ({
        userId: membership.userId,
        name: membership.name,
      })),
    };
  });
