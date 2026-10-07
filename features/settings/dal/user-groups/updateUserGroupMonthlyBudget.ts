import prisma from '@/server/db';

type UpdateUserGroupMonthlyBudgetInput = {
  userGroupId: string;
  monthlyBudget: number | null;
};

export default async function updateUserGroupMonthlyBudget({
  userGroupId,
  monthlyBudget,
}: UpdateUserGroupMonthlyBudgetInput) {
  const userGroup = await prisma.userGroup.update({
    where: {
      id: userGroupId,
      deletedAt: null,
    },
    data: {
      monthlyBudget,
    },
    select: {
      id: true,
      label: true,
      monthlyBudget: true,
      updatedAt: true,
    },
  });

  return userGroup;
}
