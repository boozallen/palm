import { trpc } from '@/libs';

export default function useGetUserGroup(userGroupId: string) {
  return trpc.settings.getUserGroup.useQuery(
    { id: userGroupId },
    { enabled: !!userGroupId },
  );
}
