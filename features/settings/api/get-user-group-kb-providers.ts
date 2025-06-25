import { trpc } from '@/libs';

export default function useGetUserGroupKbProviders(userGroupId: string) {
  return trpc.settings.getUserGroupKbProviders.useQuery(
    { userGroupId: userGroupId },
    {
      enabled: !!userGroupId,
    }
  );
}
