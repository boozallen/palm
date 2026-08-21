import { trpc } from '@/libs';

export function useGetUserGraphDatabaseAccess() {
  return trpc.shared.getUserGraphDatabaseAccess.useQuery();
}