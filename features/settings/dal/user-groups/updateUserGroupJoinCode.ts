import logger from '@/server/logger';
import db from '@/server/db';
import { UserGroup } from '@/features/shared/types';

type UpdateUserGroupJoinCode = {
  id: string;
  joinCode: string;
};

export default async function updateUserGroupJoinCode(
  input: UpdateUserGroupJoinCode,
): Promise<UserGroup> {
  const result = await db.userGroup.update({
    where: { id: input.id, deletedAt: null },
    data: { joinCode: input.joinCode },
    include: {
      _count: {
        select: { userGroupMemberships: true },
      },
    },
  });

  if (!result) {
    logger.warn(`User Group could not be found: ${input.id}`);
    throw new Error('User Group could not be found.');
  }

  return (({ id, label, joinCode, createdAt, updatedAt, graphDatabaseEnabled, workflowsEnabled, agenticChatEnabled, contextStudioEnabled, _count }) => ({
    id,
    label,
    joinCode,
    createdAt,
    updatedAt,
    graphDatabaseEnabled,
    workflowsEnabled,
    agenticChatEnabled,
    contextStudioEnabled,
    memberCount: _count.userGroupMemberships,
  }))(result);
}
