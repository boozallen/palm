import { trpc } from '@/libs';

export default function useUpdateUserGroupAgentProviders() {
  const utils = trpc.useContext();

  return trpc.settings.updateUserGroupAgentProviders.useMutation({
    onSuccess: (data, input) => {
      utils.settings.getUserGroupAgentProviders.setData(
        { id: input.userGroupId },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return {
            userGroupAgentProviders: data.userGroupAgentProviders.map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              createdAt: p.createdAt,
              updatedAt: p.updatedAt,
            })),
          };
        }
      );
      utils.shared.getAvailableAgentProviders.invalidate();
    },
  });
}
