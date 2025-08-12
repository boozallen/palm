import { trpc } from '@/libs';

/**
 * Fetches chats and messages based on userId
 */
export default function useGetChats() {
  return trpc.chat.getChats.useQuery();
}
