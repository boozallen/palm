import { trpc } from '@/libs';

export default function useUpdateUserGroupMonthlyBudget() {
  const utils = trpc.useContext();

  return trpc.settings.updateUserGroupMonthlyBudget.useMutation({
    onSuccess: (data, input) => {
      utils.settings.getUserGroup.setData(
        { id: input.userGroupId },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return {
            ...oldData,
            monthlyBudget: data.userGroup.monthlyBudget,
          };
        }
      );
    },
  });
}
