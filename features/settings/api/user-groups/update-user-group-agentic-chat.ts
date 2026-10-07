import { trpc } from '@/libs';

export default function useUpdateUserGroupAgenticChat() {
  const utils = trpc.useContext();

  return trpc.settings.updateUserGroupAgenticChat.useMutation({
    onSuccess: (data, input) => {
      utils.settings.getUserGroup.setData(
        { id: input.userGroupId },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return {
            ...oldData,
            agenticChatEnabled: data.userGroup.agenticChatEnabled,
          };
        },
      );
    },
  });
}
