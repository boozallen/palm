import { trpc } from '@/libs';

export function useToggleBookmark() {
  const utils = trpc.useContext();

  return trpc.library.toggleBookmark.useMutation({
    onSuccess: () => {
      utils.library.getPrompts.invalidate();
      utils.library.getPromptStats.invalidate();
    },
  });
}
