import { trpc } from '@/libs';

export default function useGetUserGroups() {
  return trpc.settings.getUserGroups.useQuery();
}
