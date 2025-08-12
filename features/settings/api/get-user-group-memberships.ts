import { trpc } from '@/libs';

type useGetUserGroupMembershipsConfig = {
  id: string;
}

export default function useGetUserGroupMemberships(config: useGetUserGroupMembershipsConfig) {
  return trpc.settings.getUserGroupMemberships.useQuery(config);
}
