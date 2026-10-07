import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import getArtifactContent from '@/features/context-studio/dal/getArtifactContent';
import getArtifactOwner from '@/features/context-studio/dal/getArtifactOwner';
import getStudioUserGroups from '@/features/context-studio/dal/getStudioUserGroups';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';

const inputSchema = z.object({
  source: z.enum(['chat', 'workflow']),
  id: z.string(),
});

const outputSchema = z.object({
  label: z.string(),
  fileExtension: z.string(),
  content: z.string().nullable(),
  binaryContent: z.string().nullable(),
}).nullable();

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      const ownerId = await getArtifactOwner(input.source, input.id);
      const isOwnArtifact = ownerId === ctx.userId;

      if (!isOwnArtifact) {
        // A Lead's authority extends only to the groups they lead, so the
        // owner must actually belong to one of those — leading is not a
        // license to download any org member's artifact.
        const ledGroups = (await getStudioUserGroups(ctx.userId, false)).filter((g) => g.isLead);
        const memberships = ownerId
          ? await Promise.all(ledGroups.map((g) => getUserGroupMembership(ownerId, g.id)))
          : [];
        const ownerInLedGroup = memberships.some((m) => m !== null);

        if (!ownerInLedGroup) {
          throw Forbidden('You do not have permission to access this resource');
        }
      }
    }

    return getArtifactContent(input.source, input.id);
  });
