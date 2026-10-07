import { trpc } from '@/libs';

export default function useUpdateUserGroupGraphDatabase() {
  const utils = trpc.useContext();

  return trpc.settings.updateUserGroupGraphDatabase.useMutation({
    onSuccess: (data, input) => {
      utils.settings.getUserGroup.setData(
        { id: input.userGroupId },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return { 
            ...oldData, 
            graphDatabaseEnabled: data.userGroup.graphDatabaseEnabled,
          };
        }
      );
    },
  });
}
