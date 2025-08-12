import { trpc } from '@/libs';

export default function useJoinUserGroupViaJoinCode() {
  const utils = trpc.useUtils();

  return trpc.profile.joinUserGroupViaJoinCode.useMutation({
    onSuccess: (data) => {
      utils.settings.getUserGroupMemberships.setData(
        { id: data.userGroupId },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return {
            userGroupMemberships: [
              ...oldData.userGroupMemberships,
              {
                userId: data.userId,
                role: data.role,
                name: data.name,
                userGroupId: data.userGroupId,
                email: data.email,
              },
            ],
          };
        }
      );
      utils.profile.getUserGroups.invalidate();
    },
  });
}
