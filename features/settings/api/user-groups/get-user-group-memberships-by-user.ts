import { trpc } from '@/libs';

export default function useGetUserGroupMembershipsByUser(userId: string) {
  return trpc.settings.getUserGroupMembershipsByUser.useQuery(
    { userId },
    { enabled: !!userId },
  );
}
