import { trpc } from '@/libs';

export default function useGetIsUserGroupLead() {
  return trpc.shared.getIsUserGroupLead.useQuery();
}
