import { trpc } from '@/libs';

export function useGetUserWorkflowsAccess() {
  return trpc.shared.getUserWorkflowsAccess.useQuery();
}