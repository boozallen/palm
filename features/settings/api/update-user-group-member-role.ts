import { trpc } from '@/libs';

export default function useUpdateUserGroupMemberRole() {
  const utils = trpc.useContext();

  return trpc.settings.updateUserGroupMemberRole.useMutation({
    onSuccess: (data) => {
      const userGroupId = { id: data.userGroupId };

      utils.settings.getUserGroupMemberships.setData(userGroupId, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return {
          userGroupMemberships: oldData.userGroupMemberships.map((member) =>
            member.userId === data.userId
              ? { ...member, role: data.role }
              : member
          ),
        };
      });

      utils.shared.getIsUserGroupLead.invalidate();
    },
  });
}
