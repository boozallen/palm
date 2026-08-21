import prisma from '@/server/db';

type UpdateUserGroupAgenticChatInput = {
  userGroupId: string;
  agenticChatEnabled: boolean;
};

export default async function updateUserGroupAgenticChat({
  userGroupId,
  agenticChatEnabled,
}: UpdateUserGroupAgenticChatInput) {
  const userGroup = await prisma.userGroup.update({
    where: {
      id: userGroupId,
    },
    data: {
      agenticChatEnabled,
    },
    select: {
      id: true,
      label: true,
      agenticChatEnabled: true,
      updatedAt: true,
    },
  });

  return userGroup;
}
