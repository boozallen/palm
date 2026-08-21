import { trpc } from '@/libs';

export default function useGetUserGroupsAsLead() {
  return trpc.settings.getUserGroupsAsLead.useQuery();
}
