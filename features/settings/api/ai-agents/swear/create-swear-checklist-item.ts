import { trpc } from '@/libs';

export default function useCreateSwearChecklistItem() {
  const utils = trpc.useUtils();

  return trpc.settings.createSwearChecklistItem.useMutation({
    onSuccess: (data) => {
      utils.settings.getSwearChecklistItems.setData({ id: data.aiAgentId }, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        const newData = {
          checklistItems: [...oldData.checklistItems, data],
        };

        return newData;
      });
    },
  });
}
