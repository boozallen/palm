import { trpc } from '@/libs';

export default function useGetUserGroupAgentProviders(userGroupId: string) {
  return trpc.settings.getUserGroupAgentProviders.useQuery({ id: userGroupId }, {
    enabled: !!userGroupId,
  });
}
