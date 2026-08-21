import { trpc } from '@/libs';

type useGetUsersListWithGroupMembershipStatusConfig = {
  userGroupId: string;
  userId?: string;
  searchQuery: string;
}

export default function useGetUsersListWithGroupMembershipStatus(config: useGetUsersListWithGroupMembershipStatusConfig) {

  return trpc.settings.getUsersListWithGroupMembershipStatus.useQuery(config, {
    enabled: !!config.userId || config.searchQuery.length > 0,
  });
}
