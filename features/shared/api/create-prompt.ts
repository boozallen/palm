import { trpc } from '@/libs';

export function useCreatePrompt() {
  const utils = trpc.useContext();

  return trpc.shared.createPrompt.useMutation({
    onSuccess: async (data) => {
      utils.library.getPrompt.setData({ promptId: data.prompt.id }, () => {
        return { prompt: data.prompt };
      });

      await utils.library.getPrompts.invalidate();
    },
  });
}
