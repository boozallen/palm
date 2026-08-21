import prisma from '@/server/db';

type UpdateUserGroupContextStudioAccessInput = {
  userGroupId: string;
  contextStudioEnabled: boolean;
};

export default async function updateUserGroupContextStudioAccess({
  userGroupId,
  contextStudioEnabled,
}: UpdateUserGroupContextStudioAccessInput) {
  const userGroup = await prisma.userGroup.update({
    where: {
      id: userGroupId,
    },
    data: {
      contextStudioEnabled,
    },
    select: {
      id: true,
      label: true,
      contextStudioEnabled: true,
      updatedAt: true,
    },
  });

  return userGroup;
}
