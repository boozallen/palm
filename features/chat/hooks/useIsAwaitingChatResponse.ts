import useGetMessages from '@/features/chat/api/get-messages';
import { AsyncChatStatus } from '@/features/chat/types/message';

/**
 * True while the worker is still producing an assistant response for this chat.
 *
 * The addMessage mutation resolves as soon as the job is queued, so mutation
 * pending state alone leaves the input usable for the whole time the response
 * is actually being generated.
 */
export default function useIsAwaitingChatResponse(chatId: string | null) {
  const messagesQry = useGetMessages(chatId);

  return !!messagesQry.data?.messages.some(
    (msg) => msg.asyncChatStatus === AsyncChatStatus.PROCESSING,
  );
}
