import { trpc } from '@/libs';

export function useUpdateUserGroupKbProviders() {
  const utils = trpc.useContext();

  return trpc.settings.updateUserGroupKbProviders.useMutation({
    onSuccess: (data, input) => {
      utils.settings.getUserGroupKbProviders.setData(
        { userGroupId: input.userGroupId },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return { userGroupKbProviders: data.userGroupKbProviders };
        }
      );
    },
  });
}
