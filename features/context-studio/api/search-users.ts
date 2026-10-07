import { trpc } from '@/libs';
import { UserSearchQuery } from '@/features/context-studio/types/user-search';

export default function useSearchUsers(query: UserSearchQuery, enabled: boolean) {
  return trpc.contextStudio.searchUsers.useQuery(query, {
    enabled,
  });
}
