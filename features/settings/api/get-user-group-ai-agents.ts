import { trpc } from '@/libs';

export default function useGetUserGroupAiAgents(userGroupId: string) {
  return trpc.settings.getUserGroupAiAgents.useQuery({ userGroupId: userGroupId }, {
    enabled: !!userGroupId,
  });
}
