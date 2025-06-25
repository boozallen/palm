import { trpc } from '@/libs';

export default function useGetUserGroupAiProviders(userGroupId: string) {
  return trpc.settings.getUserGroupAiProviders.useQuery({ id: userGroupId }, {
    enabled: !!userGroupId,
  });
}
