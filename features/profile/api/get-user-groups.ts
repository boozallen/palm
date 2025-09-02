import { trpc } from '@/libs';

export default function useGetUserGroups() {
  return trpc.profile.getUserGroups.useQuery();
}
