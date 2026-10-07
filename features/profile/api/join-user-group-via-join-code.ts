import { trpc } from '@/libs';

export default function useJoinUserGroupViaJoinCode() {
  const utils = trpc.useUtils();

  return trpc.profile.joinUserGroupViaJoinCode.useMutation({
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
                userId: data.userId,
                role: data.role,
                name: data.name,
                userGroupId: data.userGroupId,
                email: data.email,
                lastLoginAt: new Date().toISOString(),
                cost: 0,
                inputTokens: 0,
                outputTokens: 0,
                monthlyCost: 0,
                monthlyInputTokens: 0,
                monthlyOutputTokens: 0,
              },
            ],
          };
        }
      );
      utils.profile.getUserGroups.invalidate();
      utils.shared.getAvailableModels.invalidate();
    },
  });
}
