import { trpc } from '@/libs';

export default function useGetChatMetadata(chatIds: string[]) {
  return trpc.chat.getChatMetadata.useQuery(
    { chatIds },
    { enabled: chatIds.length > 0 },
  );
}
