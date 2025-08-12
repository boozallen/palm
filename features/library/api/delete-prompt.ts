import { trpc } from '@/libs';

export default function useDeletePrompt() {
  const utils = trpc.useContext();

  return trpc.library.deletePrompt.useMutation({
    onSuccess: (data) => {
      utils.library.getPrompts.invalidate();

      utils.library.getPrompt.invalidate({ promptId: data.id });
    },
  });
}
