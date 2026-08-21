import { trpc } from '@/libs';

export default function useCreateUserGroup() {
  const utils = trpc.useContext();

  return trpc.settings.createUserGroup.useMutation({
    onSuccess: (data) => {
      utils.settings.getUserGroups.setData(undefined, (oldData) => {
        if (!oldData) {
          return { userGroups: [data] };
        }

        return { userGroups: [...oldData.userGroups, data] };
      });
    },
  });
}
