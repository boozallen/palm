import { trpc } from '@/libs';

export default function useUpdateUserGroupAiProviders() {
  const utils = trpc.useContext();

  return trpc.settings.updateUserGroupAiProviders.useMutation({
    onSuccess: (data, input) => {
      utils.settings.getUserGroupAiProviders.setData(
        { id: input.userGroupId },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return { userGroupProviders: data.userGroupAiProviders };
        }
      );
    },
  });
}
