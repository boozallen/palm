import { trpc } from '@/libs';

export default function useDeleteUserGroup() {
  const utils = trpc.useContext();

  return trpc.settings.deleteUserGroup.useMutation({
    onSuccess: (data) => {
      utils.settings.getUserGroup.setData({ id: data.id }, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return undefined;
      });

      utils.settings.getUserGroups.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        const newData = {
          userGroups: oldData.userGroups.filter(
            (userGroup) => userGroup.id !== data.id
          ),
        };

        return newData;
      });

      utils.settings.getUserGroupMemberships.setData(
        { id: data.id },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return undefined;
        }
      );

      utils.settings.getUserGroupAiProviders.setData(
        { id: data.id },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return undefined;
        }
      );

      // utils.settings.getUserGroupKnowledgeBases.setData(
      //   { groupId: data.id },
      //   (oldData) => {
      //     if (!oldData) {
      //       return oldData;
      //     }

      //     return undefined;
      //   }
      // );

      utils.profile.getUserGroups.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        const newData = {
          userGroups: oldData.userGroups.filter(
            (userGroup) => userGroup.id !== data.id
          ),
        };

        return newData;
      });
    },
  });
}
