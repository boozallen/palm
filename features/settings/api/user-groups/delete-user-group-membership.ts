import { trpc } from '@/libs';

export default function useDeleteUserGroupMembership() {
  const utils = trpc.useContext();

  return trpc.settings.deleteUserGroupMembership.useMutation({
    onSuccess: (data) => {
      utils.settings.getUserGroupMemberships.setData(
        { id: data.userGroupId },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return {
            userGroupMemberships: oldData.userGroupMemberships.filter(
              (memberships) => memberships.userId !== data.userId
            ),
          };
        }
      );
      // The removed user's own sidebar (UserGroupAttributionProvider) reads profile.getUserGroups,
      // not this admin-facing list — invalidate it too so a self-removal reflects immediately.
      utils.profile.getUserGroups.invalidate();
    },
  });
}
