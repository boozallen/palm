import { trpc } from '@/libs';

export function useGetBookmarks() {
  return trpc.library.getBookmarks.useQuery();
}