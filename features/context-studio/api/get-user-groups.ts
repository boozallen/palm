import { trpc } from '@/libs';

export default function useGetUserGroups() {
  return trpc.contextStudio.getUserGroups.useQuery();
}
