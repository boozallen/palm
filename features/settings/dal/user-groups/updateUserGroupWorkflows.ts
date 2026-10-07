import prisma from '@/server/db';

type UpdateUserGroupWorkflowsInput = {
  userGroupId: string;
  workflowsEnabled: boolean;
};

export default async function updateUserGroupWorkflows({
  userGroupId,
  workflowsEnabled,
}: UpdateUserGroupWorkflowsInput) {
  const userGroup = await prisma.userGroup.update({
    where: {
      id: userGroupId,
      deletedAt: null,
    },
    data: {
      workflowsEnabled,
    },
    select: {
      id: true,
      label: true,
      workflowsEnabled: true,
      updatedAt: true,
    },
  });

  return userGroup;
}