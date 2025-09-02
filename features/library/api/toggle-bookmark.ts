import { trpc } from '@/libs';

export function useToggleBookmark() {
  return trpc.library.toggleBookmark.useMutation();
}
