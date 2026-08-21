import { trpc } from '@/libs';

export default function useUpdateUserGroupContextStudioAccess() {
  const utils = trpc.useContext();

  return trpc.settings.updateUserGroupContextStudioAccess.useMutation({
    onSuccess: (data, input) => {
      utils.settings.getUserGroup.setData(
        { id: input.userGroupId },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return {
            ...oldData,
            contextStudioEnabled: data.userGroup.contextStudioEnabled,
          };
        }
      );
      // Invalidate the Context Studio access query to update navigation visibility
      utils.shared.getUserContextStudioAccess.invalidate();
    },
  });
}
