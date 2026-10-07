import { procedure } from '@/server/trpc';
import getSharedDocuments from '@/features/shared/dal/document-library/upload/getSharedDocuments';
import getUserGroups from '@/features/profile/dal/getUserGroups';
import { GetSharedDocumentsResultSchema } from '@/features/shared/types/document';

export default procedure
  .output(GetSharedDocumentsResultSchema)
  .query(async ({ ctx }) => {
    const { userId } = ctx;

    // Get user's group memberships
    const userGroups = await getUserGroups(userId);
    const userGroupIds = userGroups.map((g) => g.id);

    return getSharedDocuments({
      userId,
      userGroupIds,
    });
  });
