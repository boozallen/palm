import { trpc } from '@/libs';

export default function useUpdateUserGroupAiAgents() {
  const utils = trpc.useUtils();

  return trpc.settings.updateUserGroupAiAgents.useMutation({
    onSuccess: (data, input) => {
      utils.settings.getUserGroupAiAgents.setData(
        { userGroupId: input.userGroupId },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return { userGroupAiAgents: data.userGroupAiAgents };
        }
      );
      utils.shared.getUserEnabledAiAgents.invalidate();
    },
  });
}
