import { trpc } from '@/libs';

export default function useDeleteSwearChecklistItem() {
  const utils = trpc.useUtils();
  return trpc.settings.deleteSwearChecklistItem.useMutation({
    onSuccess: (data) => {
      utils.settings.getSwearChecklistItems.setData({ id: data.aiAgentId }, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        const newData = {
          checklistItems: oldData.checklistItems.filter((item) => item.id !== data.id),
        };

        return newData;
      });
    },
  });
}
