import { trpc } from '@/libs';

export default function useUpdateSwearChecklistItem() {
  const utils = trpc.useUtils();
  return trpc.settings.updateSwearChecklistItem.useMutation({
    onSuccess: (data) => {
      utils.settings.getSwearChecklistItems.setData({ id: data.aiAgentId }, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        const newData = {
          checklistItems: oldData.checklistItems.map((item) =>
            item.id === data.id ? data : item
          ),
        };

        return newData;
      });
    },
  });
}
