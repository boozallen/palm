import { trpc } from '@/libs';

export default function useUpdatePrompt() {
  const utils = trpc.useContext();

  return trpc.library.updatePrompt.useMutation({
    onSuccess: (data) => {
      utils.library.getPrompts.setData({}, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        const index = oldData.prompts.findIndex((prompt) => prompt.id === data.id);
        const newData = [...oldData.prompts];
        newData[index] = data;

        return { prompts: newData };
      });

      utils.library.getPrompt.setData({ promptId: data.id }, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return { prompt: data };
      });
    },
  });
}
