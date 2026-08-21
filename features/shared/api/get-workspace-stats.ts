import { trpc } from '@/libs';

export default function useGetWorkspaceStats() {
  return trpc.shared.getWorkspaceStats.useQuery();
}
