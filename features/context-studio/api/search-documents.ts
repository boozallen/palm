import { trpc } from '@/libs';
import { DocumentSearchQuery } from '@/features/context-studio/types/chat-search';

export default function useSearchDocuments(query: DocumentSearchQuery, enabled: boolean) {
  return trpc.contextStudio.searchDocuments.useQuery(query, {
    enabled,
  });
}
