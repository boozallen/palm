import { trpc } from '@/libs';

type useGetUsersListWithRoleConfig = {
  searchQuery: string;
  userId?: string;
}

export default function useGetUsersListWithRole(config: useGetUsersListWithRoleConfig) {
  return trpc.settings.getUsersListWithRole.useQuery(config, {
    enabled: !!config.userId || config.searchQuery.length > 0,
  });
}
