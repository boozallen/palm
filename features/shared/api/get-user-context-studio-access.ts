import { trpc } from '@/libs';

export function useGetUserContextStudioAccess() {
  return trpc.shared.getUserContextStudioAccess.useQuery();
}
