import { AIFactory } from '@/features/ai-provider';
import resolveUserGroupId from '@/features/shared/services/resolveUserGroupId';

// ctx.ai is built before a mutation's input is parsed, so it can't carry the group chosen
// in that input — validate membership and build a fresh factory scoped to that group instead.
export default async function resolveGroupScopedAiFactory(
  userId: string,
  userGroupId: string | null | undefined,
): Promise<AIFactory> {
  const validatedUserGroupId = await resolveUserGroupId(userId, userGroupId);
  return new AIFactory({ userId, userGroupId: validatedUserGroupId ?? undefined });
}
