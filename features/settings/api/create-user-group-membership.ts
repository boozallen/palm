import { trpc } from '@/libs';

export default function useCreateUserGroupMembership() {
  const utils = trpc.useContext();

  return trpc.settings.createUserGroupMembership.useMutation({
    onSuccess: (data) => {
      utils.settings.getUserGroupMemberships.setData(
        { id: data.userGroupId },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return {
            userGroupMemberships: [...oldData.userGroupMemberships, data],
          };
        }
      );
    },
  });
}
