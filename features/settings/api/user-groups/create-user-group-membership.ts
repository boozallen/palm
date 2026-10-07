import { trpc } from '@/libs';

export default function useCreateUserGroupMembership() {
  const utils = trpc.useContext();

  return trpc.settings.createUserGroupMembership.useMutation({
    onSuccess: (data) => {
      utils.settings.getUserGroupMemberships.setData(
        { id: data.userGroupId },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return {
            userGroupMemberships: [
              ...oldData.userGroupMemberships,
              {
                ...data,
                cost: data.cost ?? 0,
                inputTokens: data.inputTokens ?? 0,
                outputTokens: data.outputTokens ?? 0,
                monthlyCost: data.monthlyCost ?? 0,
                monthlyInputTokens: data.monthlyInputTokens ?? 0,
                monthlyOutputTokens: data.monthlyOutputTokens ?? 0,
              },
            ],
          };
        }
      );
      // The added user's own sidebar (UserGroupAttributionProvider) reads profile.getUserGroups,
      // not this admin-facing list — invalidate it too so a self-add is reflected immediately.
      utils.profile.getUserGroups.invalidate();
    },
  });
}
