import { trpc } from '@/libs';

/**
 * Fetches a conversation by its chatId
 *
 * @param chatId
 */
export default function useGetChat(chatId: string) {
  return trpc.chat.getUserChat.useQuery({ chatId }, {
    enabled: !!chatId,
  });
}
