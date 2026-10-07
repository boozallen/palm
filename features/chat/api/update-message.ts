import { useQueryClient } from '@tanstack/react-query';
import { getQueryKey } from '@trpc/react-query';

import { trpc } from '@/libs';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { MessageRole } from '@/features/chat/types/message';

export default function useUpdateMessage() {
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const { selectedGraphSnapshotId, setSelectedGraphSnapshotId } = useChat();

  return trpc.chat.updateMessage.useMutation({
    onSuccess: (data) => {
      const cachedMessage = utils.chat.getMessages
        .getData({ chatId: data.chatId })
        ?.messages.find((message) => message.id === data.chatMessageId);
      const removedSnapshotId = cachedMessage?.role === MessageRole.User
        ? cachedMessage.graphSnapshot?.id
        : undefined;

      utils.chat.getMessages.setData(
        { chatId: data.chatId },
        (oldData) => {
          if (!oldData) {
            return oldData;
          };
          return {
            ...oldData,
            messages: oldData.messages.map((message) =>
              message.id === data.chatMessageId
                ? {
                    ...message,
                    ...data,
                    ...(message.role === MessageRole.User
                      ? { graphSnapshot: null }
                      : {}),
                  }
                : message,
            ),
          };
        }
      );

      if (removedSnapshotId && removedSnapshotId === selectedGraphSnapshotId) {
        setSelectedGraphSnapshotId(null);
        queryClient.removeQueries({
          queryKey: getQueryKey(
            trpc.chat.getSnapshotGraph,
            { snapshotId: removedSnapshotId },
            'query',
          ),
          exact: true,
        });
      }
    },
  });
}
