import isUserGroupMember from '@/features/shared/dal/isUserGroupMember';
import { Forbidden } from '@/features/shared/errors/routeErrors';

// Shared membership check for routes that need the validated group id itself (e.g. to store
// or queue), rather than an AIFactory scoped to it — see resolveGroupScopedAiFactory for that case.
export default async function resolveUserGroupId(
  userId: string,
  userGroupId: string | null | undefined,
): Promise<string | null> {
  if (!userGroupId) {
    return null;
  }

  const isMember = await isUserGroupMember(userId, userGroupId);
  if (!isMember) {
    throw Forbidden('You are not a member of the selected group');
  }

  return userGroupId;
}
