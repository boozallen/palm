import { trpc } from '@/libs';
import { keepPreviousData } from '@tanstack/react-query';

/**
 * Fetches a chats messages by their chatId
 *
 * @param chatId
 */
export default function useGetMessages(chatId: string | null) {
  return trpc.chat.getMessages.useQuery({ chatId: chatId || '' }, {
    enabled: !!chatId,
    placeholderData: keepPreviousData,
  });
}
