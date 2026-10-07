import { trpc } from '@/libs';
import { ChatSearchQuery } from '@/features/context-studio/types/chat-search';

export default function useSearchChats(query: ChatSearchQuery, enabled: boolean) {
  return trpc.contextStudio.searchChats.useQuery(query, {
    enabled,
  });
}
