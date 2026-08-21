import prisma from '@/server/db';

type UpdateUserGroupGraphDatabaseInput = {
  userGroupId: string;
  graphDatabaseEnabled: boolean;
};

export default async function updateUserGroupGraphDatabase({
  userGroupId,
  graphDatabaseEnabled,
}: UpdateUserGroupGraphDatabaseInput) {
  const userGroup = await prisma.userGroup.update({
    where: {
      id: userGroupId,
    },
    data: {
      graphDatabaseEnabled,
    },
    select: {
      id: true,
      label: true,
      graphDatabaseEnabled: true,
      updatedAt: true,
    },
  });

  return userGroup;
}