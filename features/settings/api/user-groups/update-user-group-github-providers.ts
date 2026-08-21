import { trpc } from '@/libs';

export default function useUpdateUserGroupGitHubProviders() {
  const utils = trpc.useContext();

  return trpc.settings.updateUserGroupGitHubProviders.useMutation({
    onSuccess: (data, input) => {
      utils.settings.getUserGroupGitHubProviders.setData(
        { id: input.userGroupId },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return {
            userGroupGitHubProviders: data.userGroupGitHubProviders.map((p) => ({
              id: p.id,
              label: p.label,
              description: p.description,
              createdAt: p.createdAt,
              updatedAt: p.updatedAt,
            })),
          };
        }
      );
    },
  });
}
