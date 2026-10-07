import { trpc } from '@/libs';

export default function useUpdateUserGroupArtifactTemplates() {
  const utils = trpc.useContext();

  return trpc.settings.updateUserGroupArtifactTemplates.useMutation({
    onSuccess: (data, input) => {
      utils.settings.getUserGroupArtifactTemplates.setData(
        { id: input.userGroupId },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return { userGroupTemplates: data.userGroupTemplates };
        },
      );
    },
  });
}
